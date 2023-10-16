const getTiles = activities => {
  const allTiles = [];
  activities.forEach(({ tiles }) => allTiles.push(...tiles.map(tile => JSON.stringify(tile))));
  const tileSet = new Set(allTiles);
  return Array.from(tileSet).map(str => {
    const { x, y } = JSON.parse(str);
    return `14/${x}/${y}`;
  });
};

export default getTiles;
