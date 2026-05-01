import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { track } from '../lib/analytics';

export function useFoodSearch() {
  const {
    searchQuery,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
    isSearching,
    searchResults,
  } = useMealReplacerStore();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    track('food_search_performed', { query_length: query.length });
    try {
      const res = await axios.get('/api/food/search', {
        params: { q: query, limit: 10 },
        withCredentials: true,
      });
      setSearchResults(res.data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [setSearchResults, setIsSearching]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      search(searchQuery);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, search, setSearchResults]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
  };
}
