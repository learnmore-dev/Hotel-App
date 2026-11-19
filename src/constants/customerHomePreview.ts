/**
 * Temporary, presentation-only content for the customer Home screen.
 * Keep preview data separate from backend types and replace it when API integration begins.
 */
export const CUSTOMER_HOME_PREVIEW = {
  destinations: [
    { id: 'jaipur', name: 'Jaipur', detail: 'Pink City escapes', mark: '✺', tone: '#F5E5D8' },
    { id: 'goa', name: 'Goa', detail: 'Coastal hideaways', mark: '≈', tone: '#E1EFF0' },
    { id: 'manali', name: 'Manali', detail: 'Mountain air', mark: '⌁', tone: '#E7EBDD' },
    { id: 'udaipur', name: 'Udaipur', detail: 'Lakeside stays', mark: '◉', tone: '#EEE8D8' },
  ],
  offers: [
    { id: 'weekend', eyebrow: 'WEEKEND ESCAPE', title: 'Make room for a getaway', detail: 'Find a stay for your next long weekend.', mark: '✦' },
    { id: 'slow-travel', eyebrow: 'SLOW TRAVEL', title: 'Stay a little longer', detail: 'Discover places worth taking your time for.', mark: '⌂' },
  ],
} as const;
