// Truck dispatch event types. Only "delivery" counts as a customer sale in volume stats.
export const TRUCK_EVENT_TYPES = [
  { value: "delivery", label: "Customer Delivery", short: "Delivery", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "internal_transfer", label: "Internal Transfer (Pier 15 / Fairhaven / 40 South)", short: "Internal transfer", badge: "bg-amber-100 text-amber-900 border-amber-200" },
  { value: "non_delivery", label: "Non-Delivery Event (training, swap, pickup, meeting)", short: "Non-delivery", badge: "bg-slate-200 text-slate-700 border-slate-300" },
];

export const eventTypeOf = (d) => d?.event_type || "delivery";
export const isCustomerDelivery = (d) => eventTypeOf(d) === "delivery";
export const eventTypeMeta = (d) => TRUCK_EVENT_TYPES.find((t) => t.value === eventTypeOf(d)) || TRUCK_EVENT_TYPES[0];
