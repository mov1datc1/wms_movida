import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { API } from '../config/api';

interface Warehouse {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  activo: boolean;
}

interface WarehouseContextType {
  warehouses: Warehouse[];
  selectedWarehouse: Warehouse | null;
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string) => void;
  refreshWarehouses: () => void;
  loading: boolean;
}

const WarehouseContext = createContext<WarehouseContextType>({
  warehouses: [],
  selectedWarehouse: null,
  selectedWarehouseId: null,
  setSelectedWarehouseId: () => {},
  refreshWarehouses: () => {},
  loading: true,
});

export function useWarehouse() {
  return useContext(WarehouseContext);
}

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseIdState] = useState<string | null>(() =>
    localStorage.getItem('wms_warehouse_id')
  );
  const [loading, setLoading] = useState(true);

  function loadWarehouses() {
    fetch(`${API}/warehouses`)
      .then(r => r.json())
      .then((data: Warehouse[]) => {
        setWarehouses(data);
        // If no warehouse selected or invalid, pick first active
        if (!selectedWarehouseId || !data.find(w => w.id === selectedWarehouseId)) {
          const first = data.find(w => w.activo) || data[0];
          if (first) {
            setSelectedWarehouseIdState(first.id);
            localStorage.setItem('wms_warehouse_id', first.id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  function setSelectedWarehouseId(id: string) {
    setSelectedWarehouseIdState(id);
    localStorage.setItem('wms_warehouse_id', id);
  }

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || null;

  return (
    <WarehouseContext.Provider value={{ warehouses, selectedWarehouse, selectedWarehouseId, setSelectedWarehouseId, refreshWarehouses: loadWarehouses, loading }}>
      {children}
    </WarehouseContext.Provider>
  );
}
