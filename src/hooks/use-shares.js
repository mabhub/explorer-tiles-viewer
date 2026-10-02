import useLocalStorageState from 'use-local-storage-state';

const defaultValue = {};

const useShares = () => useLocalStorageState('shares', { defaultValue });

export default useShares;
