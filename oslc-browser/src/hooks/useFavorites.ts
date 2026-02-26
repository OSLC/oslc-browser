import { useState, useCallback } from 'react';
import type { FavoriteItem } from '../models/types.js';

const STORAGE_KEY = 'oslc-browser-favorites';

function generateId(): string {
  return crypto.randomUUID();
}

function loadFavorites(): FavoriteItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveFavorites(items: FavoriteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// Recursively remove an item by id
function removeById(items: FavoriteItem[], id: string): FavoriteItem[] {
  return items
    .filter(item => item.id !== id)
    .map(item => ({
      ...item,
      children: item.children ? removeById(item.children, id) : undefined,
    }));
}

// Recursively add an item to a parent folder
function addToFolder(items: FavoriteItem[], parentId: string, newItem: FavoriteItem): FavoriteItem[] {
  return items.map(item => {
    if (item.id === parentId && item.type === 'folder') {
      return { ...item, children: [...(item.children ?? []), newItem] };
    }
    if (item.children) {
      return { ...item, children: addToFolder(item.children, parentId, newItem) };
    }
    return item;
  });
}

// Recursively rename an item
function renameItem(items: FavoriteItem[], id: string, name: string): FavoriteItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, name };
    if (item.children) return { ...item, children: renameItem(item.children, id, name) };
    return item;
  });
}

// Toggle folder expanded state
function toggleExpanded(items: FavoriteItem[], id: string): FavoriteItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, expanded: !item.expanded };
    if (item.children) return { ...item, children: toggleExpanded(item.children, id) };
    return item;
  });
}

export interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  addFolder: (name: string, parentId?: string) => void;
  addResource: (name: string, uri: string, parentId?: string) => void;
  removeItem: (id: string) => void;
  rename: (id: string, name: string) => void;
  toggleFolder: (id: string) => void;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  const update = useCallback((updater: (prev: FavoriteItem[]) => FavoriteItem[]) => {
    setFavorites(prev => {
      const next = updater(prev);
      saveFavorites(next);
      return next;
    });
  }, []);

  const addFolder = useCallback((name: string, parentId?: string) => {
    const folder: FavoriteItem = {
      id: generateId(),
      name,
      type: 'folder',
      children: [],
      expanded: true,
    };
    update(prev => parentId ? addToFolder(prev, parentId, folder) : [...prev, folder]);
  }, [update]);

  const addResource = useCallback((name: string, uri: string, parentId?: string) => {
    const resource: FavoriteItem = {
      id: generateId(),
      name,
      type: 'resource',
      uri,
    };
    update(prev => parentId ? addToFolder(prev, parentId, resource) : [...prev, resource]);
  }, [update]);

  const removeItemFn = useCallback((id: string) => {
    update(prev => removeById(prev, id));
  }, [update]);

  const renameFn = useCallback((id: string, name: string) => {
    update(prev => renameItem(prev, id, name));
  }, [update]);

  const toggleFolderFn = useCallback((id: string) => {
    update(prev => toggleExpanded(prev, id));
  }, [update]);

  return {
    favorites,
    addFolder,
    addResource,
    removeItem: removeItemFn,
    rename: renameFn,
    toggleFolder: toggleFolderFn,
  };
}
