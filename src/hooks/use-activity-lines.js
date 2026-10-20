import { decodePolyline } from '../activity-lines';
import useSharePages from './use-share-pages';

export const linesEndpoint = import.meta.env.VITE_LINES_ENDPOINT;

// Lines are simplified to 1 m: a point every 15 m on average, many of them
// in line, made them up to 4 times heavier to draw (1.3 million points for
// the 1 500 activities of one share, a quarter once simplified), the
// difference staying under a pixel up to zoom 15.
const lineTolerance = 1;

// Pages are kept encoded in the cache, decoded once per page fetched, each
// line with the Statshunters id of its activity (`ids`, same order).
// Lines of a single point are not drawn.
const options = {
  kind:     'lines',
  endpoint: linesEndpoint,
  getItems: data => data.lines,
  select:   data => ({
    ...data,
    lines: data.lines
      .map((line, index) => ({
        id:     data.ids?.[index],
        points: decodePolyline(line, lineTolerance),
      }))
      .filter(({ points }) => points.length > 1),
  }),
};

// One result per share: { data: [shareId, [{ id, points }]], isComplete, … }, see
// use-share-pages. Only for the shares whose link allows the lines: the
// endpoint refuses the others (403).
const useActivityLines = shareIdsString => useSharePages(shareIdsString, options);

export default useActivityLines;
