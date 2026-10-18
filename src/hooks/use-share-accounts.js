import { useQueries } from '@tanstack/react-query';

const endpoint = import.meta.env.VITE_ACCOUNT_ENDPOINT;

const getAccount = async shareId => {
  const response = await fetch(endpoint.replace('{{id}}', shareId));
  if (!response.ok) {
    throw new Error(`Failed to fetch account for ${shareId}: HTTP ${response.status}`);
  }
  return response.json();
};

export const getAccountName = account => [account?.firstname, account?.lastname]
  .filter(Boolean)
  .join(' ');

// Without the endpoint, shares are simply shown by id
const useShareAccounts = shareIds => useQueries({
  queries: shareIds.map(shareId => ({
    queryKey: ['account', shareId],
    queryFn: () => getAccount(shareId),
    enabled: Boolean(endpoint),
  })),
});

export default useShareAccounts;
