import React from 'react';
import { useQueries } from '@tanstack/react-query';

const getActivities = async shareId => {
  const rawResponse = await fetch(import.meta.env.VITE_ACTIVITIES_ENDPOINT.replace('{{id}}', shareId));
  const activities = await rawResponse.json();
  return [shareId, activities];
};

const EMPTY = [];

const useActivities = shareIdsString => {
  const queries = React.useMemo(
    () => {
      if (!shareIdsString) { return EMPTY; }
      const ids = shareIdsString.split(',').map(str => str.trim());
      return ids.map(shareId => ({
        queryKey: [shareId],
        queryFn: () => getActivities(shareId),
        staleTime: Infinity,
      }));
    },
    [shareIdsString],
  );

  const responses = useQueries({ queries });

  const combinedStatus = responses.map?.(({ isLoading, isFetching, isError, isFetched }) =>
    [isLoading, isFetching, isError, isFetched].map(b => b.toString()).join(',')).join(',');

  const memoResponse = React.useMemo(
    () => responses,
    [shareIdsString, combinedStatus], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return memoResponse;
};

export default useActivities;
