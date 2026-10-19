import React from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';

// Data of a share fetched one Statshunters page at a time (activities, lines):
// `kind` names the queries, `endpoint` has a {{id}} placeholder and is
// followed by /<page>, `getItems` reads the items of a page.

const getPageKey = (kind, shareId, page) => [kind, shareId, page];

// One Statshunters page: { <items>, nextPage }, nextPage null on the last one
const getPage = async ({ kind, endpoint }, shareId, page) => {
  const url = `${endpoint.replace('{{id}}', shareId)}/${page}`;
  const rawResponse = await fetch(url);
  if (!rawResponse.ok) {
    throw Object.assign(
      new Error(`Failed to fetch ${kind} page ${page} for ${shareId}: HTTP ${rawResponse.status}`),
      { status: rawResponse.status },
    );
  }
  return rawResponse.json();
};

// Pages to observe: the first one, then each one announced by a loaded page.
// Known pages are all refreshed at once, new ones come one after another.
const getSharePages = (queryClient, kind, shareId) => {
  const pages = [];
  for (let page = 1; page;) {
    pages.push(page);
    const nextPage = queryClient.getQueryData(getPageKey(kind, shareId, page))?.nextPage;
    page = nextPage > page ? nextPage : null;
  }
  return pages;
};

// Pages of a share seen as one query: data holds the items of the pages
// loaded so far, isComplete tells whether the last page is among them
const combinePages = (shareId, pageResults, getItems) => {
  const loaded = pageResults.filter(({ data }) => data);
  const errors = pageResults.filter(({ isError }) => isError);
  const lastPage = pageResults[pageResults.length - 1];

  return {
    data:           loaded.length
      ? [shareId, loaded.flatMap(({ data }) => getItems(data))]
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

const EMPTY = [];

// One result per share, its pages combined (see combinePages). `options` must
// keep the same identity between renders.
const useSharePages = (shareIdsString, options) => {
  const { kind, getItems } = options;
  const queryClient = useQueryClient();
  const ids = shareIdsString ? shareIdsString.split(',').map(str => str.trim()) : EMPTY;
  // Recomputed at each render: a page just loaded adds the next one
  const pagesByShare = ids.map(shareId => getSharePages(queryClient, kind, shareId));
  const pagesString = pagesByShare.map(pages => pages.join(' ')).join(',');

  const queries = React.useMemo(
    () => ids.flatMap((shareId, index) => pagesByShare[index].map(page => ({
      queryKey: getPageKey(kind, shareId, page),
      queryFn:  () => getPage(options, shareId, page),
      select:   options.select,
    }))),
    [options, shareIdsString, pagesString], // eslint-disable-line react-hooks/exhaustive-deps
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
        return combinePages(shareId, responses.slice(start - length, start), getItems);
      });
    },
    [queries, combinedStatus], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return memoResponse;
};

export default useSharePages;
