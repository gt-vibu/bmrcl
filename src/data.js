export async function getMetroData() {
const response = await fetch(`${import.meta.env.VITE_API_URL}/api/metro-data`);  if (!response.ok) {
    throw new Error('Unable to load metro data from MongoDB');
  }

  return response.json();
}

export const getFare = (numStations, options, fareRules) => {
  const slabs = fareRules?.slabs ?? [];
  const matchingSlab = slabs.find((slab) => slab.maxStations === null || numStations <= slab.maxStations);
  const baseFare = matchingSlab?.fare ?? 0;

  if (options.userType === 'token') return baseFare;

  const discounts = fareRules?.discounts ?? {};
  let discount = 0;

  if (options.dayType === 'holiday') {
    discount = discounts.cardHoliday ?? 0;
  } else {
    discount = options.timeType === 'peak'
      ? discounts.cardPeak ?? 0
      : discounts.cardNonPeak ?? 0;
  }

  return Math.round(baseFare * (1 - discount));
};
