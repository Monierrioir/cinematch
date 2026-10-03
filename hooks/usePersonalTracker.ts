"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MediaType } from "@/lib/types";
import {
  addToCustomList,
  createCustomList,
  deleteCustomList,
  getUserStats,
  getYearlyRecap,
  loadTrackingStore,
  moveWatchlistToWatched,
  removeFromCustomList,
  removeWatchedStatus,
  renameCustomList,
  saveWatchedItem,
  toggleWatchlist,
  updateRating,
  type TrackableTitleInput,
  type TrackingStore
} from "@/lib/personal-tracker";

export function usePersonalTracker() {
  const [store, setStore] = useState<TrackingStore | null>(null);

  const refresh = useCallback(() => {
    setStore(loadTrackingStore());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markWatched = useCallback(
    (title: TrackableTitleInput, options?: { watchedDate?: string; rewatch?: boolean }) => {
      setStore(saveWatchedItem(title, options));
    },
    []
  );

  const removeWatched = useCallback((mediaType: MediaType, id: number) => {
    setStore(removeWatchedStatus(mediaType, id));
  }, []);

  const setRating = useCallback((mediaType: MediaType, id: number, rating: number | null) => {
    setStore(updateRating(mediaType, id, rating));
  }, []);

  const toggleInWatchlist = useCallback((title: TrackableTitleInput) => {
    const result = toggleWatchlist(title);
    setStore(result.store);
    return result.inWatchlist;
  }, []);

  const createList = useCallback((name: string) => {
    setStore(createCustomList(name));
  }, []);

  const renameList = useCallback((listId: string, name: string) => {
    setStore(renameCustomList(listId, name));
  }, []);

  const deleteList = useCallback((listId: string) => {
    setStore(deleteCustomList(listId));
  }, []);

  const addItemToList = useCallback((listId: string, title: TrackableTitleInput) => {
    setStore(addToCustomList(listId, title));
  }, []);

  const removeItemFromList = useCallback((listId: string, mediaType: MediaType, id: number) => {
    setStore(removeFromCustomList(listId, mediaType, id));
  }, []);

  const moveToWatched = useCallback((mediaType: MediaType, id: number, watchedDate?: string) => {
    setStore(moveWatchlistToWatched(mediaType, id, watchedDate));
  }, []);

  const stats = useMemo(() => (store ? getUserStats(store) : null), [store]);
  const getRecap = useCallback(
    (year: number) => (store ? getYearlyRecap(year, store) : getYearlyRecap(year)),
    [store]
  );

  return {
    store,
    refresh,
    stats,
    getRecap,
    markWatched,
    removeWatched,
    setRating,
    toggleInWatchlist,
    createList,
    renameList,
    deleteList,
    addItemToList,
    removeItemFromList,
    moveToWatched
  };
}
