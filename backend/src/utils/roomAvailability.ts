export type RoomBookingInterval = {
  checkIn: Date;
  checkOut: Date;
  roomsCount: number;
};

/** Maximum rooms occupied simultaneously across the given intervals. Check-out is exclusive. */
export function calculatePeakBookedRooms(
  bookings: RoomBookingInterval[],
  range?: { start: Date; end: Date },
): number {
  const events = new Map<number, number>();
  let occupiedAtRangeStart = 0;

  for (const booking of bookings) {
    if (booking.roomsCount <= 0) continue;
    const originalStart = booking.checkIn.getTime();
    const originalEnd = booking.checkOut.getTime();
    const start = range ? Math.max(originalStart, range.start.getTime()) : originalStart;
    const end = range ? Math.min(originalEnd, range.end.getTime()) : originalEnd;
    if (start >= end) continue;

    if (range && originalStart <= range.start.getTime()) {
      occupiedAtRangeStart += booking.roomsCount;
    } else {
      events.set(start, (events.get(start) ?? 0) + booking.roomsCount);
    }
    events.set(end, (events.get(end) ?? 0) - booking.roomsCount);
  }

  let occupied = occupiedAtRangeStart;
  let peak = occupied;
  for (const [, delta] of [...events.entries()].sort(([left], [right]) => left - right)) {
    occupied += delta;
    peak = Math.max(peak, occupied);
  }
  return peak;
}
