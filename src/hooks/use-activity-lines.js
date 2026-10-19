import { decodePolyline } from '../activity-lines';
import useSharePages from './use-share-pages';

export const linesEndpoint = import.meta.env.VITE_LINES_ENDPOINT;

// Pages are kept encoded in the cache, decoded once per page fetched.
// Lines of a single point are not drawn.
const options = {
  kind:     'lines',
  endpoint: linesEndpoint,
  getItems: data => data.lines,
  select:   data => ({
    ...data,
    lines: data.lines.map(decodePolyline).filter(points => points.length > 1),
  }),
};

// One result per share: { data: [shareId, lines], isComplete, … }, see
// use-share-pages. Only for the shares whose link allows the lines: the
// endpoint refuses the others (403).
const useActivityLines = shareIdsString => useSharePages(shareIdsString, options);

export default useActivityLines;
