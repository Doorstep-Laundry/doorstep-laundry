"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "@prisma/client";
import { getTimeSlots, type TimeSlot } from "@/lib/slots";
import type { LoadOptionsInput } from "@/lib/load-options";
import { LOAD_OPTION_KEYS, LOAD_OPTION_LABELS } from "@/lib/load-options";
import { useGoogleMapsScript } from "@/hooks/use-google-maps";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { BookingAvailability } from "@/lib/booking-availability";
import {
  firstAllowedTimeSlotId,
  findNextValidDeliveryDate,
  findNextValidPickupDate,
  isAnySlotEnabledOnDay,
  isDeliveryDateUnavailable,
  isPickupDateUnavailable,
  isSlotEnabledForDay,
} from "@/lib/booking-availability";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyLoadOptions: LoadOptionsInput = {};

export type BookFormInitialOrder = {
  numberOfLoads: number;
  pickupDate: Date | string;
  deliveryDate: Date | string;
  pickupTimeSlot: string;
  deliveryTimeSlot: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  notes: string;
  loadOptions?: LoadOptionsInput[];
};

export function BookForm({
  addresses,
  editOrderId,
  initialOrder,
  defaultLoadOptions,
  bookingAvailability,
}: {
  addresses: Address[];
  defaultTotalCents?: number;
  editOrderId?: string;
  initialOrder?: BookFormInitialOrder;
  /** Customer default load options (for new orders); applied to each load when creating. */
  defaultLoadOptions?: LoadOptionsInput | null;
  /** Admin-configured days and morning/evening windows for pickup & delivery. */
  bookingAvailability: BookingAvailability;
}) {
  const router = useRouter();
  const timeSlots = getTimeSlots();
  const isEdit = Boolean(editOrderId && initialOrder);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pastDueOrderIds, setPastDueOrderIds] = useState<string[]>([]);

  // Step 1 state — one preferences block per load (length = numberOfLoads)
  const [loadOptions, setLoadOptions] = useState<LoadOptionsInput[]>(() => {
    const defaults = defaultLoadOptions ?? emptyLoadOptions;
    if (initialOrder?.loadOptions && initialOrder.loadOptions.length > 0) {
      return initialOrder.loadOptions.map((row) => ({ ...defaults, ...row }));
    }
    const n =
      initialOrder?.numberOfLoads != null && initialOrder.numberOfLoads >= 1
        ? initialOrder.numberOfLoads
        : 1;
    return Array.from({ length: n }, () => ({ ...defaults }));
  });

  const numberOfLoads = loadOptions.length;

  function addLoadPreferences() {
    const defaults = defaultLoadOptions ?? emptyLoadOptions;
    setLoadOptions((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, { ...defaults }];
    });
  }

  function removeLoadPreferences(index: number) {
    setLoadOptions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, j) => j !== index);
    });
  }
  const [pickupDate, setPickupDate] = useState<Date>(() => {
    if (initialOrder?.pickupDate) {
      const d = new Date(initialOrder.pickupDate);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [deliveryDate, setDeliveryDate] = useState<Date>(() => {
    if (initialOrder?.deliveryDate) {
      const d = new Date(initialOrder.deliveryDate);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pickupTimeSlot, setPickupTimeSlot] = useState(initialOrder?.pickupTimeSlot ?? timeSlots[0]?.id ?? "morning");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState(initialOrder?.deliveryTimeSlot ?? timeSlots[0]?.id ?? "morning");
  const [dayPickerStart, setDayPickerStart] = useState(0);

  // Step 2 state
  const [newAddress, setNewAddress] = useState({
    label: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  });
  const [useNewPickup, setUseNewPickup] = useState(!isEdit && addresses.length === 0);
  const [useNewDelivery, setUseNewDelivery] = useState(!isEdit && addresses.length === 0);
  const [pickupAddressId, setPickupAddressId] = useState(initialOrder?.pickupAddressId ?? addresses[0]?.id ?? "");
  const [deliveryAddressId, setDeliveryAddressId] = useState(initialOrder?.deliveryAddressId ?? addresses[0]?.id ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    suggested?: { street: string; city: string; state: string; zip: string };
    message?: string;
  } | null>(null);
  type PendingSave = { mode: "add" } | { mode: "order" };
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { loaded: mapsLoaded } = useGoogleMapsScript(mapsApiKey);

  function addressPartsEqual(
    a: { street: string; city: string; state: string; zip: string },
    b: { street: string; city: string; state: string; zip: string }
  ) {
    return (
      a.street.trim() === b.street.trim() &&
      a.city.trim() === b.city.trim() &&
      a.state.trim() === b.state.trim() &&
      a.zip.trim() === b.zip.trim()
    );
  }

  async function verifyAddress(parts: { street: string; city: string; state: string; zip: string }) {
    const res = await fetch("/api/addresses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parts),
    });
    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      suggested?: { street: string; city: string; state: string; zip: string };
      message?: string;
    };
    return {
      valid: data.valid ?? false,
      suggested: data.suggested,
      message: data.message,
    };
  }

  const pickupDateStr = pickupDate.toISOString().slice(0, 10);
  const deliveryDateStr = deliveryDate.toISOString().slice(0, 10);
  const bookingDaysKey = `${bookingAvailability.morningByDay.join(",")}|${bookingAvailability.eveningByDay.join(",")}`;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []); // stable for effect deps (session-scoped)

  // Earliest delivery: at least 24 hrs after pickup (next day or later)
  const earliestDeliveryDate = useMemo(() => {
    const d = new Date(pickupDate);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [pickupDate]);

  const now = new Date();
  const isPickupToday =
    pickupDate.getFullYear() === now.getFullYear() &&
    pickupDate.getMonth() === now.getMonth() &&
    pickupDate.getDate() === now.getDate();
  const currentHourLocal = now.getHours() + now.getMinutes() / 60;

  const pickupDow = pickupDate.getDay();
  const deliveryDow = deliveryDate.getDay();

  function isPickupSlotDisabled(slot: TimeSlot): boolean {
    if (!isSlotEnabledForDay(slot.id, pickupDow, bookingAvailability)) return true;
    if (!isPickupToday) return false;
    const cutoffHour = slot.startHour - 1;
    return currentHourLocal >= cutoffHour;
  }

  function isDeliverySlotDisabled(slot: TimeSlot): boolean {
    return !isSlotEnabledForDay(slot.id, deliveryDow, bookingAvailability);
  }

  const hasValidSlotForToday = timeSlots.some(
    (slot) =>
      isSlotEnabledForDay(slot.id, today.getDay(), bookingAvailability) &&
      currentHourLocal < slot.startHour - 1
  );

  // Keep delivery at least 24h after pickup (e.g. when pickup date changes)
  useEffect(() => {
    if (deliveryDate < earliestDeliveryDate) {
      const next = new Date(earliestDeliveryDate);
      queueMicrotask(() => setDeliveryDate(next));
    }
  }, [pickupDateStr, deliveryDate, earliestDeliveryDate]);

  // Clamp pickup to next admin-allowed day (and not “today” when no slot left)
  useEffect(() => {
    const now = new Date();
    if (isPickupDateUnavailable(pickupDate, now, bookingAvailability, timeSlots)) {
      const next = findNextValidPickupDate(pickupDate, now, bookingAvailability, timeSlots);
      const cur = new Date(pickupDate);
      cur.setHours(0, 0, 0, 0);
      if (cur.getTime() !== next.getTime()) {
        queueMicrotask(() => setPickupDate(next));
      }
    }
  }, [pickupDateStr, pickupDate, bookingDaysKey, timeSlots, bookingAvailability]);

  // Clamp delivery to allowed days on/after earliest day
  useEffect(() => {
    const now = new Date();
    if (isDeliveryDateUnavailable(deliveryDate, earliestDeliveryDate, now, bookingAvailability)) {
      const next = findNextValidDeliveryDate(
        deliveryDate,
        earliestDeliveryDate,
        now,
        bookingAvailability
      );
      const cur = new Date(deliveryDate);
      cur.setHours(0, 0, 0, 0);
      if (cur.getTime() !== next.getTime()) {
        queueMicrotask(() => setDeliveryDate(next));
      }
    }
  }, [deliveryDateStr, deliveryDate, earliestDeliveryDate, bookingDaysKey, bookingAvailability]);

  useEffect(() => {
    const dow = pickupDate.getDay();
    if (!isSlotEnabledForDay(pickupTimeSlot, dow, bookingAvailability)) {
      const id = firstAllowedTimeSlotId(bookingAvailability, timeSlots, dow);
      queueMicrotask(() => setPickupTimeSlot(id));
    }
  }, [pickupTimeSlot, pickupDateStr, bookingDaysKey, bookingAvailability, timeSlots]);

  useEffect(() => {
    const dow = deliveryDate.getDay();
    if (!isSlotEnabledForDay(deliveryTimeSlot, dow, bookingAvailability)) {
      const id = firstAllowedTimeSlotId(bookingAvailability, timeSlots, dow);
      queueMicrotask(() => setDeliveryTimeSlot(id));
    }
  }, [deliveryTimeSlot, deliveryDateStr, bookingDaysKey, bookingAvailability, timeSlots]);

  const dayPickerDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayPickerStart + i);
    return d;
  });

  function goPrevDays() {
    setDayPickerStart((s) => Math.max(-1, s - 7));
  }
  function goNextDays() {
    setDayPickerStart((s) => s + 7);
  }

  function handleStep1Continue() {
    const now = new Date();
    if (deliveryDate < earliestDeliveryDate) {
      setError("Delivery must be at least 24 hours after pickup (next day or later).");
      return;
    }
    if (isPickupDateUnavailable(pickupDate, now, bookingAvailability, timeSlots)) {
      setError("That pickup day or time isn’t available. Choose another date or window.");
      return;
    }
    if (isDeliveryDateUnavailable(deliveryDate, earliestDeliveryDate, now, bookingAvailability)) {
      setError("That delivery day isn’t available. Choose another date.");
      return;
    }
    if (!isSlotEnabledForDay(pickupTimeSlot, pickupDate.getDay(), bookingAvailability)) {
      setError("Choose an available pickup time.");
      return;
    }
    if (!isSlotEnabledForDay(deliveryTimeSlot, deliveryDate.getDay(), bookingAvailability)) {
      setError("Choose an available delivery time.");
      return;
    }
    const selectedPickupSlot = timeSlots.find((s) => s.id === pickupTimeSlot);
    if (selectedPickupSlot && isPickupSlotDisabled(selectedPickupSlot)) {
      setError("This pickup time has passed or is within 1 hour. Please choose another.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function doAddAddress(addr: { street: string; city: string; state: string; zip: string }) {
    const payload = {
      ...newAddress,
      ...addr,
      isDefault: addresses.length === 0,
    };
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to add address");
      return;
    }
    router.refresh();
    setNewAddress({ label: "", street: "", city: "", state: "", zip: "" });
    setUseNewPickup(false);
    setUseNewDelivery(false);
    setPickupAddressId(data.id);
    setDeliveryAddressId(data.id);
    setVerifyResult(null);
    setPendingSave(null);
  }

  async function handleAddAddress() {
    if (
      !newAddress.label ||
      !newAddress.street ||
      !newAddress.city ||
      !newAddress.state ||
      !newAddress.zip
    ) {
      setError("Fill all address fields");
      return;
    }
    setError("");
    setLoading(true);
    setVerifyResult(null);
    setPendingSave(null);
    try {
      const result = await verifyAddress({
        street: newAddress.street,
        city: newAddress.city,
        state: newAddress.state,
        zip: newAddress.zip,
      });
      const verificationSkipped = !result.valid && result.message?.toLowerCase().includes("not configured");
      if (!result.valid && !verificationSkipped) {
        setError(result.message ?? "Address could not be verified.");
        setLoading(false);
        return;
      }
      if (result.valid && result.suggested && !addressPartsEqual(newAddress, result.suggested)) {
        setVerifyResult(result);
        setPendingSave({ mode: "add" });
        setLoading(false);
        return;
      }
      await doAddAddress(result.valid && result.suggested ? result.suggested : newAddress);
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  async function submitWithAddress(addr: { street: string; city: string; state: string; zip: string }) {
    const addressPayload = { ...newAddress, ...addr };
    let finalPickupId = pickupAddressId;
    let finalDeliveryId = deliveryAddressId;

    if (useNewPickup && newAddress.label && newAddress.street) {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add pickup address");
        return;
      }
      finalPickupId = data.id;
      if (useNewDelivery && useNewPickup) {
        finalDeliveryId = data.id;
      }
    }
    if (
      useNewDelivery &&
      newAddress.label &&
      newAddress.street &&
      !(useNewPickup && finalPickupId)
    ) {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add delivery address");
        return;
      }
      finalDeliveryId = data.id;
    }

    if (!finalPickupId || !finalDeliveryId) {
      setError("Please select or add pickup and delivery addresses.");
      return;
    }

    const orderPayload = {
      pickupAddressId: finalPickupId,
      deliveryAddressId: finalDeliveryId,
      pickupDate: pickupDateStr,
      deliveryDate: deliveryDateStr,
      pickupTimeSlot,
      deliveryTimeSlot,
      notes: notes || undefined,
      numberOfLoads: loadOptions.length,
      loadOptions,
    };
    const url = editOrderId ? `/api/orders/${editOrderId}` : "/api/orders";
    const method = editOrderId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 402 && Array.isArray(data.pastDueOrderIds)) {
        setPastDueOrderIds(data.pastDueOrderIds as string[]);
      }
      setError(data.error ?? (editOrderId ? "Failed to update order" : "Failed to create order"));
      return;
    }
    setVerifyResult(null);
    setPendingSave(null);
    router.push(editOrderId ? `/orders/${editOrderId}` : `/orders/${data.id}`);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifyResult(null);
    setPendingSave(null);

    const usingNewAddress = (useNewPickup || useNewDelivery) && newAddress.label && newAddress.street;
    if (usingNewAddress) {
      setLoading(true);
      try {
        const result = await verifyAddress({
          street: newAddress.street,
          city: newAddress.city,
          state: newAddress.state,
          zip: newAddress.zip,
        });
        const verificationSkipped = !result.valid && result.message?.toLowerCase().includes("not configured");
        if (!result.valid && !verificationSkipped) {
          setError(result.message ?? "Address could not be verified.");
          setLoading(false);
          return;
        }
        if (result.valid && result.suggested && !addressPartsEqual(newAddress, result.suggested)) {
          setVerifyResult(result);
          setPendingSave({ mode: "order" });
          setLoading(false);
          return;
        }
        await submitWithAddress(result.valid && result.suggested ? result.suggested : newAddress);
      } catch {
        setError("Something went wrong");
      }
      setLoading(false);
      return;
    }

    const finalPickupId = pickupAddressId;
    const finalDeliveryId = deliveryAddressId;
    if (!finalPickupId || !finalDeliveryId) {
      setError("Please select or add pickup and delivery addresses.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        pickupAddressId: finalPickupId,
        deliveryAddressId: finalDeliveryId,
        pickupDate: pickupDateStr,
        deliveryDate: deliveryDateStr,
        pickupTimeSlot,
        deliveryTimeSlot,
        notes: notes || undefined,
        numberOfLoads: loadOptions.length,
        loadOptions,
      };
      const url = editOrderId ? `/api/orders/${editOrderId}` : "/api/orders";
      const method = editOrderId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402 && Array.isArray(data.pastDueOrderIds)) {
          setPastDueOrderIds(data.pastDueOrderIds as string[]);
        }
        setError(data.error ?? (editOrderId ? "Failed to update order" : "Failed to create order"));
        setLoading(false);
        return;
      }
      router.push(editOrderId ? `/orders/${editOrderId}` : `/orders/${data.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  const inputClass =
    "block w-full rounded-lg border border-fern-200 bg-white px-3 py-2.5 text-fern-900 placeholder-fern-400 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20";
  const labelClass = "block text-sm font-medium text-fern-700";

  // ——— Step 1: Date & time (screenshot-style) ———
  if (step === 1) {
    return (
      <div className="rounded-2xl border border-fern-200/80 bg-white p-6 sm:p-8 shadow-sm max-w-2xl">
        <h2 className="text-2xl font-bold text-fern-900 mb-6">
          {isEdit ? "Edit pickup & delivery" : "Book your pickup"}
        </h2>

        {/* Per-load options */}
        <div className="mb-6">
          <p className="font-semibold text-fern-900 mb-2">Options per load</p>
          <p className="text-sm text-fern-500 mb-3">
            Set wash preferences for each load (e.g. hot water, hypoallergenic).
          </p>
          <div className="space-y-4">
            {loadOptions.map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-fern-200 bg-fern-50/30 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-fern-800">Load {i + 1}</p>
                  {loadOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLoadPreferences(i)}
                      className="text-xs font-medium text-fern-600 hover:text-red-700 shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {LOAD_OPTION_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-1.5 text-sm text-fern-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(loadOptions[i]?.[key])}
                        onChange={(e) => {
                          setLoadOptions((prev) => {
                            const next = [...prev];
                            const row = { ...(next[i] ?? {}) };
                            row[key] = e.target.checked;
                            next[i] = row;
                            return next;
                          });
                        }}
                        className="rounded border-fern-300 text-fern-600 focus:ring-fern-500"
                      />
                      {LOAD_OPTION_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLoadPreferences}
            disabled={loadOptions.length >= 10}
            className="mt-4 w-full rounded-lg border-2 border-dashed border-fern-300 bg-fern-50/50 py-2.5 text-sm font-medium text-fern-700 hover:bg-fern-100 hover:border-fern-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add load preferences
          </button>
        </div>

        {/* Pickup date */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-fern-900">Pickup date</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrevDays}
                className="p-1.5 rounded-lg text-fern-600 hover:bg-fern-100 hover:text-fern-900"
                aria-label="Previous days"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                onClick={goNextDays}
                className="p-1.5 rounded-lg text-fern-600 hover:bg-fern-100 hover:text-fern-900"
                aria-label="Next days"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-fern-500 mb-2">
            {pickupDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <div className="flex flex-wrap gap-2">
            {dayPickerDates.map((d) => {
              const isSelected = d.getTime() === pickupDate.getTime();
              const isPast = d < today;
              const isToday = d.getTime() === today.getTime();
              const todayUnavailable = isToday && !hasValidSlotForToday;
              const dayClosed = !isAnySlotEnabledOnDay(d.getDay(), bookingAvailability);
              const disabled = isPast || todayUnavailable || dayClosed;
              return (
                <button
                  key={d.toISOString().slice(0, 10)}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    const newPickup = new Date(d);
                    setPickupDate(newPickup);
                    const minDelivery = new Date(newPickup);
                    minDelivery.setDate(minDelivery.getDate() + 1);
                    minDelivery.setHours(0, 0, 0, 0);
                    if (deliveryDate < minDelivery) setDeliveryDate(minDelivery);
                  }}
                  disabled={disabled}
                  className={`min-w-[4rem] rounded-lg border-2 py-2 px-3 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-fern-500 bg-fern-500 text-white"
                      : disabled
                        ? "border-fern-100 bg-fern-50 text-fern-400 cursor-not-allowed"
                        : "border-fern-200 bg-white text-fern-800 hover:border-fern-300"
                  }`}
                >
                  {DAY_LABELS[d.getDay()]} {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pickup time */}
        <div className="mb-6">
          <p className="font-semibold text-fern-900 mb-2">Pickup time</p>
          <div className="grid grid-cols-2 gap-2">
            {timeSlots.map((slot) => {
              const disabled = isPickupSlotDisabled(slot);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => !disabled && setPickupTimeSlot(slot.id)}
                  disabled={disabled}
                  className={`rounded-xl border-2 py-2.5 px-3 text-sm font-medium transition-colors ${
                    disabled
                      ? "border-fern-100 bg-fern-50 text-fern-400 cursor-not-allowed"
                      : pickupTimeSlot === slot.id
                        ? "border-fern-500 bg-fern-50 text-fern-800"
                        : "border-fern-200 bg-white text-fern-700 hover:border-fern-300"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delivery date */}
        <div className="mb-6">
          <p className="font-semibold text-fern-900 mb-2">Delivery date</p>
          <p className="text-sm text-fern-500 mb-2">
            At least 24 hours after pickup (next day or later). {deliveryDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <div className="flex flex-wrap gap-2">
            {dayPickerDates.map((d) => {
              const isSelected = d.getTime() === deliveryDate.getTime();
              const isPast = d < today;
              const beforeEarliest = d < earliestDeliveryDate;
              const dayClosed = !isAnySlotEnabledOnDay(d.getDay(), bookingAvailability);
              const disabled = isPast || beforeEarliest || dayClosed;
              return (
                <button
                  key={d.toISOString().slice(0, 10)}
                  type="button"
                  onClick={() => !disabled && setDeliveryDate(new Date(d))}
                  disabled={disabled}
                  className={`min-w-[4rem] rounded-lg border-2 py-2 px-3 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-fern-500 bg-fern-500 text-white"
                      : disabled
                        ? "border-fern-100 bg-fern-50 text-fern-400 cursor-not-allowed"
                        : "border-fern-200 bg-white text-fern-800 hover:border-fern-300"
                  }`}
                >
                  {DAY_LABELS[d.getDay()]} {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delivery time */}
        <div className="mb-6">
          <p className="font-semibold text-fern-900 mb-2">Delivery time</p>
          <div className="grid grid-cols-2 gap-2">
            {timeSlots.map((slot) => {
              const disabled = isDeliverySlotDisabled(slot);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => !disabled && setDeliveryTimeSlot(slot.id)}
                  disabled={disabled}
                  className={`rounded-xl border-2 py-2.5 px-3 text-sm font-medium transition-colors ${
                    disabled
                      ? "border-fern-100 bg-fern-50 text-fern-400 cursor-not-allowed"
                      : deliveryTimeSlot === slot.id
                        ? "border-fern-500 bg-fern-50 text-fern-800"
                        : "border-fern-200 bg-white text-fern-700 hover:border-fern-300"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        <button
          type="button"
          onClick={handleStep1Continue}
          className="w-full rounded-lg bg-fern-500 text-white py-3 font-medium hover:bg-fern-600 transition-colors"
        >
          Continue to address & details
        </button>
      </div>
    );
  }

  // ——— Step 2: Addresses & notes ———
  return (
    <div className="rounded-2xl border border-fern-200/80 bg-white p-6 sm:p-8 shadow-sm max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-fern-900">
          {isEdit ? "Edit address & details" : "Address & details"}
        </h2>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm font-medium text-fern-600 hover:text-fern-900"
        >
          Change date & time
        </button>
      </div>
      <div className="rounded-lg bg-fern-50 border border-fern-200 p-3 mb-6 text-sm text-fern-700">
        <strong>Pickup:</strong> {pickupDate.toLocaleDateString()} ({getTimeSlots().find((s) => s.id === pickupTimeSlot)?.label}) &nbsp;|&nbsp;{" "}
        <strong>Delivery:</strong> {deliveryDate.toLocaleDateString()} ({getTimeSlots().find((s) => s.id === deliveryTimeSlot)?.label}) &nbsp;|&nbsp; {numberOfLoads} load{numberOfLoads !== 1 ? "s" : ""}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {pastDueOrderIds.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Outstanding balance</p>
            <p className="mb-2">Please pay your previous order{pastDueOrderIds.length > 1 ? "s" : ""} before scheduling a new pickup.</p>
            <div className="flex flex-wrap gap-2">
              {pastDueOrderIds.map((id, i) => (
                <a
                  key={id}
                  href={`/orders/${id}`}
                  className="inline-block rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700"
                >
                  Pay order {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
        {error && !pastDueOrderIds.length && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <h3 className="text-lg font-medium text-fern-900 mb-3">Pickup address</h3>
          {addresses.length > 0 && !useNewPickup && (
            <select
              value={pickupAddressId}
              onChange={(e) => setPickupAddressId(e.target.value)}
              className={inputClass}
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label} – {a.street}, {a.city}</option>
              ))}
            </select>
          )}
          {addresses.length > 0 && (
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={useNewPickup}
                onChange={(e) => setUseNewPickup(e.target.checked)}
                className="rounded border-fern-200 text-fern-500 focus:ring-fern-500"
              />
              <span className="text-sm text-fern-600">Use a new address</span>
            </label>
          )}
          {(useNewPickup || addresses.length === 0) && (
            <div className="mt-2 grid gap-2">
              <input placeholder="Label (e.g. Home)" value={newAddress.label} onChange={(e) => setNewAddress((a) => ({ ...a, label: e.target.value }))} className={inputClass} />
              {mapsApiKey && (
                <div>
                  <label className="block text-xs font-medium text-fern-500 mb-0.5">Search address (optional)</label>
                  <AddressAutocomplete
                    apiKey={mapsApiKey}
                    scriptLoaded={mapsLoaded}
                    onSelect={(parts) => setNewAddress((a) => ({ ...a, ...parts }))}
                    placeholder="Start typing your address for suggestions…"
                    className={inputClass}
                  />
                </div>
              )}
              <input placeholder="Street" value={newAddress.street} onChange={(e) => setNewAddress((a) => ({ ...a, street: e.target.value }))} className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))} className={inputClass} />
                <input placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress((a) => ({ ...a, state: e.target.value }))} className={inputClass} />
              </div>
              <input placeholder="ZIP" value={newAddress.zip} onChange={(e) => setNewAddress((a) => ({ ...a, zip: e.target.value }))} className={inputClass} />
              {pendingSave?.mode === "add" && verifyResult?.valid && verifyResult.suggested && (
                <div className="rounded-lg p-3 text-sm bg-fern-50 text-fern-800">
                  <p className="font-medium mb-1">Suggested address:</p>
                  <p className="text-fern-600 mb-2">
                    {verifyResult.suggested.street}, {verifyResult.suggested.city}, {verifyResult.suggested.state} {verifyResult.suggested.zip}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await doAddAddress(verifyResult.suggested!);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="rounded-lg bg-fern-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
                    >
                      Use suggested
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await doAddAddress(newAddress);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="rounded-lg border border-fern-200 bg-white px-3 py-1.5 text-sm font-medium text-fern-700 hover:bg-fern-50 disabled:opacity-50"
                    >
                      Save as entered
                    </button>
                  </div>
                </div>
              )}
              {addresses.length === 0 && (
                <button type="button" onClick={handleAddAddress} disabled={loading} className="rounded-lg bg-fern-100 text-fern-700 px-4 py-2 text-sm font-medium hover:bg-fern-200">
                  {loading ? "Verifying…" : "Add address"}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium text-fern-900 mb-3">Delivery address</h3>
          {addresses.length > 0 && !useNewDelivery && (
            <select
              value={deliveryAddressId}
              onChange={(e) => setDeliveryAddressId(e.target.value)}
              className={inputClass}
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label} – {a.street}, {a.city}</option>
              ))}
            </select>
          )}
          {addresses.length > 0 && (
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={useNewDelivery} onChange={(e) => setUseNewDelivery(e.target.checked)} className="rounded border-fern-200 text-fern-500 focus:ring-fern-500" />
              <span className="text-sm text-fern-600">Use a new address</span>
            </label>
          )}
          {(useNewDelivery || addresses.length === 0) && !useNewPickup && addresses.length > 0 && (
            <p className="mt-2 text-sm text-fern-500">Reusing the new address form above for delivery.</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${inputClass}`} />
        </div>

        {pendingSave?.mode === "order" && verifyResult?.valid && verifyResult.suggested && (
          <div className="rounded-lg p-3 text-sm bg-fern-50 text-fern-800">
            <p className="font-medium mb-1">Suggested address:</p>
            <p className="text-fern-600 mb-2">
              {verifyResult.suggested.street}, {verifyResult.suggested.city}, {verifyResult.suggested.state} {verifyResult.suggested.zip}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await submitWithAddress(verifyResult.suggested!);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="rounded-lg bg-fern-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
              >
                Use suggested
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await submitWithAddress(newAddress);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="rounded-lg border border-fern-200 bg-white px-3 py-1.5 text-sm font-medium text-fern-700 hover:bg-fern-50 disabled:opacity-50"
              >
                Save as entered
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || pastDueOrderIds.length > 0 || (pendingSave?.mode === "order" && !!verifyResult?.suggested)}
          className="w-full rounded-lg bg-fern-500 text-white py-3 font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
        >
          {loading
            ? (isEdit ? "Saving…" : "Verifying…")
            : isEdit
              ? "Save changes"
              : "Create order"}
        </button>
      </form>
    </div>
  );
}
