import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryUnit, BarcodeFormat } from '../types';
import { storageService } from '../services/storageService';
import { BarcodePrintSheet } from './BarcodePrintSheet';
import { X, Loader2, Printer, Plus } from 'lucide-react';

interface InventoryUnitsModalProps {
  item: InventoryItem;
  onClose: () => void;
  onUnitsChanged: () => void;
}

export const InventoryUnitsModal: React.FC<InventoryUnitsModalProps> = ({ item, onClose, onUnitsChanged }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [counts, setCounts] = useState({ available: 0, sold: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState('');
  const [format, setFormat] = useState<BarcodeFormat>('code128');
  const [printUnits, setPrintUnits] = useState<InventoryUnit[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');

  const loadUnits = async () => {
    setIsLoading(true);
    const [allUnits, unitCounts] = await Promise.all([
      storageService.getInventoryUnits(item.id),
      storageService.getInventoryUnitCounts(item.id),
    ]);
    setUnits(allUnits);
    setCounts(unitCounts);
    const missing = Math.max(0, item.stock - unitCounts.available);
    setGenerateCount(missing > 0 ? missing.toString() : '1');
    setIsLoading(false);
  };

  useEffect(() => {
    loadUnits();
  }, [item.id, item.stock]);

  const handleGenerate = async () => {
    const count = parseInt(generateCount);
    if (isNaN(count) || count <= 0) return alert('Enter a valid number of units to generate');

    setIsGenerating(true);
    const result = await storageService.generateInventoryUnits(item.id, count);
    setIsGenerating(false);

    if (!result.success) {
      alert(result.error || 'Failed to generate barcodes');
      return;
    }

    await loadUnits();
    onUnitsChanged();
    alert(`Generated ${count} barcode(s) successfully.`);
  };

  const handlePrintAvailable = () => {
    const available = units.filter(u => u.status === 'available');
    if (available.length === 0) return alert('No available units to print');
    setPrintUnits(available);
  };

  const handlePrintAll = () => {
    if (units.length === 0) return alert('No units to print');
    setPrintUnits(units);
  };

  const filteredUnits = statusFilter === 'all' ? units : units.filter(u => u.status === statusFilter);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Units / Barcodes</h3>
              <p className="text-sm text-gray-500">{item.name} — Stock: {item.stock}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100 bg-gray-50 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded p-3 border border-gray-200">
              <div className="text-2xl font-bold text-green-600">{counts.available}</div>
              <div className="text-xs text-gray-500 uppercase font-semibold">Available</div>
            </div>
            <div className="bg-white rounded p-3 border border-gray-200">
              <div className="text-2xl font-bold text-orange-600">{counts.sold}</div>
              <div className="text-xs text-gray-500 uppercase font-semibold">Sold</div>
            </div>
            <div className="bg-white rounded p-3 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{counts.total}</div>
              <div className="text-xs text-gray-500 uppercase font-semibold">Total</div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Generate barcodes for</label>
                <input
                  type="number"
                  min="1"
                  value={generateCount}
                  onChange={e => setGenerateCount(e.target.value)}
                  className="w-24 p-2 border border-gray-300 rounded text-sm"
                />
                <span className="text-sm text-gray-500 ml-1">unit(s)</span>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Label format</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value as BarcodeFormat)}
                  className="p-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="code128">Code 128 (Barcode)</option>
                  <option value="qr">QR Code</option>
                </select>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Generate
              </button>
            </div>

            {item.stock > 0 && counts.available < item.stock && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                This item has stock of {item.stock} but only {counts.available} available barcode(s).
                Generate {item.stock - counts.available} more to match current stock.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePrintAvailable}
                disabled={counts.available === 0}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <Printer size={16} /> Print Available ({counts.available})
              </button>
              <button
                onClick={handlePrintAll}
                disabled={counts.total === 0}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                <Printer size={16} /> Print All ({counts.total})
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto min-h-0">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Unit List</h4>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="text-xs border border-gray-300 rounded p-1"
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : filteredUnits.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No units yet. Generate barcodes above.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredUnits.map(unit => (
                  <div key={unit.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
                    <span className="font-mono text-xs text-gray-700">{unit.barcode}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      unit.status === 'available' ? 'bg-green-100 text-green-700' :
                      unit.status === 'sold' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {unit.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {printUnits && (
        <BarcodePrintSheet
          itemName={item.name}
          itemPrice={item.price}
          units={printUnits}
          format={format}
          onClose={() => setPrintUnits(null)}
        />
      )}
    </>
  );
};
