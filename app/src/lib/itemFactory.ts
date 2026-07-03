import type { Item, ItemType } from '@/store/gameStore';

let itemIdCounter = 0;

export const makeItem = (type: ItemType): Item => ({
  type,
  id: `item-${++itemIdCounter}-${Math.random().toString(36).slice(2, 6)}`,
});

/** Reset the item id counter (used by resetGame to keep ids compact). */
export const resetItemIdCounter = () => {
  itemIdCounter = 0;
};
