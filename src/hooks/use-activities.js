import React from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';

const getActivitiesKey = (shareId, page) => ['activities', shareId, page];

// One Statshunters page: { activities, nextPage }, nextPage null on the last one
const getActivitiesPage = async (shareId, page) => {
  const url = `${import.meta.env.VITE_ACTIVITIES_ENDPOINT.replace('{{id}}', shareId)}/${page}`;
  const rawResponse = await fetch(url);
  if (!rawResponse.ok) {
    throw Object.assign(
      new Error(`Failed to fetch activities page ${page} for ${shareId}: HTTP ${rawResponse.status}`),
      { status: rawResponse.status },
    );
  }
  return rawResponse.json();
};

// Pages to observe: the first one, then each one announced by a loaded page.
// Known pages are all refreshed at once, new ones come one after another.
const getSharePages = (queryClient, shareId) => {
  const pages = [];
  for (let page = 1; page;) {
    pages.push(page);
    const nextPage = queryClient.getQueryData(getActivitiesKey(shareId, page))?.nextPage;
    page = nextPage > page ? nextPage : null;
  }
  return pages;
};

// Pages of a share seen as one query: data holds the activities of the pages
// loaded so far, isComplete tells whether the last page is among them
const combinePages = (shareId, pageResults) => {
  const loaded = pageResults.filter(({ data }) => data);
  const errors = pageResults.filter(({ isError }) => isError);
  const lastPage = pageResults[pageResults.length - 1];

  return {
    data:           loaded.length
      ? [shareId, loaded.flatMap(({ data }) => data.activities)]
      : undefined,
    isComplete:     lastPage.data?.nextPage === null,
    isFetching:     pageResults.some(({ isFetching }) => isFetching),
    isError:        errors.length > 0,
    // Pages still failed from an earlier attempt are not being retried
    failureCount:   Math.max(0, ...pageResults
      .filter(({ isFetching }) => isFetching)
      .map(({ failureCount }) => failureCount)),
    errorUpdatedAt: Math.max(...pageResults.map(({ errorUpdatedAt }) => errorUpdatedAt)),
    // Only the failed pages are fetched again
    refetch:        () => Promise.all(errors.map(({ refetch }) => refetch())),
  };
};

// The Statshunters user behind each loaded share, by share id
export const getPersonByShare = (shareIds, activityQueries) => Object.fromEntries(
  shareIds.map((id, index) => [id, activityQueries[index]?.data?.[1][0]?.user_id]),
);

const EMPTY = [];

// One result per share, its pages combined (see combinePages)
const useActivities = shareIdsString => {
  const queryClient = useQueryClient();
  const ids = shareIdsString ? shareIdsString.split(',').map(str => str.trim()) : EMPTY;
  // Recomputed at each render: a page just loaded adds the next one
  const pagesByShare = ids.map(shareId => getSharePages(queryClient, shareId));
  const pagesString = pagesByShare.map(pages => pages.join(' ')).join(',');

  const queries = React.useMemo(
    () => ids.flatMap((shareId, index) => pagesByShare[index].map(page => ({
      queryKey: getActivitiesKey(shareId, page),
      queryFn:  () => getActivitiesPage(shareId, page),
    }))),
    [shareIdsString, pagesString], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const responses = useQueries({ queries });

  // failureCount: retries are shown while loading
  const combinedStatus = responses.map(({
    isFetching, isError, dataUpdatedAt, failureCount,
  }) => [isFetching, isError, dataUpdatedAt, failureCount].join(',')).join(',');

  const memoResponse = React.useMemo(
    () => {
      let start = 0;
      return ids.map((shareId, index) => {
        const { length } = pagesByShare[index];
        start += length;
        return combinePages(shareId, responses.slice(start - length, start));
      });
    },
    [queries, combinedStatus], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return memoResponse;
};

export default useActivities;
