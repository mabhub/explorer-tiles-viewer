import useSharePages from './use-share-pages';

const options = {
  kind:     'activities',
  endpoint: import.meta.env.VITE_ACTIVITIES_ENDPOINT,
  getItems: data => data.activities,
};

// One result per share: { data: [shareId, activities], isComplete, … }, see
// use-share-pages. Activities: { user_id, tiles, foreignId, name, date, type }
const useActivities = shareIdsString => useSharePages(shareIdsString, options);

// The Statshunters user behind each loaded share, by share id
export const getPersonByShare = (shareIds, activityQueries) => Object.fromEntries(
  shareIds.map((id, index) => [id, activityQueries[index]?.data?.[1][0]?.user_id]),
);

export default useActivities;
