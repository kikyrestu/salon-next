"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, User, Plus, Save, X, Trash2 } from "lucide-react";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import PermissionGate from "@/components/PermissionGate";
import { format, parse, addMinutes } from "date-fns";

interface Staff {
    _id: string;
    name: string;
}

interface Slot {
    _id?: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    slotDuration: number;
    notes?: string;
}

export default function StaffSlotsPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<string>("");
    const [creationType, setCreationType] = useState<'date' | 'day'>('date');
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [selectedDay, setSelectedDay] = useState<string>("Monday");
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [slotForm, setSlotForm] = useState({
        startTime: "09:00",
        endTime: "09:30",
        slotDuration: 30,
        isAvailable: true,
        notes: ""
    });

    const daysOfWeek = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    useEffect(() => {
        fetchStaff();
    }, []);

    useEffect(() => {
        if (selectedStaff && (creationType === 'date' ? selectedDate : selectedDay)) {
            fetchSlots();
        } else {
            setSlots([]);
        }
    }, [selectedStaff, selectedDate, selectedDay, creationType]);

    const fetchStaff = async () => {
        try {
            const res = await fetch("/api/staff/slots-list");
            const data = await res.json();
            if (data.success) {
                setStaffList(data.data);
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        }
    };

    const fetchSlots = async () => {
        if (!selectedStaff) return;
        if (creationType === 'date' && !selectedDate) return;
        if (creationType === 'day' && !selectedDay) return;

        setLoading(true);
        try {
            const query = creationType === 'date'
                ? `staffId=${selectedStaff}&date=${selectedDate}&type=date`
                : `staffId=${selectedStaff}&dayOfWeek=${selectedDay}&type=day`;

            const res = await fetch(`/api/staff-slots?${query}`);
            const data = await res.json();
            if (data.success && data.data.availableSlots) {
                setSlots(data.data.availableSlots.map((s: any) => ({
                    _id: s._id,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    isAvailable: s.isAvailable !== false,
                    slotDuration: s.slotDuration || 30,
                    notes: s.notes || ""
                })));
            } else {
                setSlots([]);
            }
        } catch (error) {
            console.error("Error fetching slots:", error);
            setSlots([]);
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        if (!selectedStaff || (creationType === 'date' ? !selectedDate : !selectedDay)) {
            setMessage({ type: 'error', text: 'Please select staff and date/day first' });
            return;
        }
        setSlotForm({
            startTime: "09:00",
            endTime: "09:30",
            slotDuration: 30,
            isAvailable: true,
            notes: ""
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSlotForm({
            startTime: "09:00",
            endTime: "09:30",
            slotDuration: 30,
            isAvailable: true,
            notes: ""
        });
    };

    const handleAddSlot = () => {
        const start = parse(slotForm.startTime, "HH:mm", new Date());
        const end = parse(slotForm.endTime, "HH:mm", new Date());

        if (start >= end) {
            setMessage({ type: 'error', text: 'End time must be after start time' });
            return;
        }

        const slotDuration = slotForm.slotDuration || 30;
        if (slotDuration <= 0) {
            setMessage({ type: 'error', text: 'Slot duration must be greater than 0' });
            return;
        }

        const newSlots: Slot[] = [];
        let currentTime = start;

        while (currentTime < end) {
            const slotStart = format(currentTime, "HH:mm");
            const slotEndTime = addMinutes(currentTime, slotDuration);

            if (slotEndTime > end) break;

            const slotEnd = format(slotEndTime, "HH:mm");

            const hasOverlap = slots.some(slot => {
                const existingStart = parse(slot.startTime, "HH:mm", new Date());
                const existingEnd = parse(slot.endTime, "HH:mm", new Date());
                return (currentTime < existingEnd && slotEndTime > existingStart);
            });

            if (!hasOverlap) {
                newSlots.push({
                    startTime: slotStart,
                    endTime: slotEnd,
                    slotDuration: slotDuration,
                    isAvailable: slotForm.isAvailable,
                    notes: slotForm.notes
                });
            }
            currentTime = slotEndTime;
        }

        if (newSlots.length === 0) {
            setMessage({ type: 'error', text: 'No slots created (overlap or duration issue)' });
            return;
        }

        const updatedSlots = [...slots, ...newSlots].sort((a, b) => {
            const aStart = parse(a.startTime, "HH:mm", new Date());
            const bStart = parse(b.startTime, "HH:mm", new Date());
            return aStart.getTime() - bStart.getTime();
        });

        setSlots(updatedSlots);
        closeModal();
        setMessage({ type: 'success', text: `${newSlots.length} slot(s) added successfully` });
        setTimeout(() => setMessage(null), 3000);
    };

    const toggleSlotAvailability = (index: number) => {
        const updatedSlots = [...slots];
        updatedSlots[index].isAvailable = !updatedSlots[index].isAvailable;
        setSlots(updatedSlots);
    };

    const removeSlot = async (index: number) => {
        const slot = slots[index];
        if (confirm(`Are you sure you want to delete the slot ${slot.startTime} - ${slot.endTime}?`)) {
            setDeleting(true);
            if (slot._id) {
                try {
                    const res = await fetch(`/api/staff-slots/${slot._id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!data.success) {
                        setMessage({ type: 'error', text: 'Failed to delete slot from database' });
                        setDeleting(false);
                        return;
                    }
                } catch (error) {
                    console.error("Error deleting slot:", error);
                    setMessage({ type: 'error', text: 'Error deleting slot' });
                    setDeleting(false);
                    return;
                }
            }
            const updatedSlots = slots.filter((_, i) => i !== index);
            setSlots(updatedSlots);
            setDeleting(false);
            setMessage({ type: 'success', text: 'Slot deleted successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleSave = async () => {
        if (!selectedStaff) return;

        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch("/api/staff-slots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId: selectedStaff,
                    date: creationType === 'date' ? selectedDate : undefined,
                    dayOfWeek: creationType === 'day' ? selectedDay : undefined,
                    type: creationType,
                    slots: slots
                })
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: 'Slots saved successfully!' });
                await fetchSlots();
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save slots' });
            }
        } catch (error) {
            console.error("Error saving slots:", error);
            setMessage({ type: 'error', text: 'Error saving slots' });
        } finally {
            setSaving(false);
        }
    };

    const selectedStaffData = staffList.find(s => s._id === selectedStaff);

    return (
        <PermissionGate resource="staffSlots" action="view">
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Staff Availability Slots</h1>
                            <p className="text-sm text-gray-500">Create and manage available time slots for staff members</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex flex-col space-y-4">
                            <div className="flex border-b border-gray-100">
                                <button
                                    onClick={() => setCreationType('date')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${creationType === 'date'
                                        ? 'border-blue-900 text-blue-900'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Date-wise Slots
                                </button>
                                <button
                                    onClick={() => setCreationType('day')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${creationType === 'day'
                                        ? 'border-blue-900 text-blue-900'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Day-wise Slots (Recurring)
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <SearchableSelect
                                    label="Select Staff"
                                    placeholder="Choose a staff member"
                                    required
                                    value={selectedStaff}
                                    onChange={(value) => setSelectedStaff(value)}
                                    options={staffList.map(s => ({ value: s._id, label: s.name }))}
                                />
                                {creationType === 'date' ? (
                                    <FormInput
                                        label="Select Date"
                                        type="date"
                                        required
                                        value={selectedDate}
                                        onChange={(e: any) => setSelectedDate(e.target.value)}
                                    />
                                ) : (
                                    <FormSelect
                                        label="Select Day"
                                        required
                                        value={selectedDay}
                                        onChange={(e: any) => setSelectedDay(e.target.value)}
                                        options={daysOfWeek.map(day => ({ value: day, label: day }))}
                                    />
                                )}
                            </div>
                        </div>

                        {selectedStaffData && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-center gap-2 text-sm text-blue-900">
                                    <User className="w-4 h-4" />
                                    <span className="font-semibold">{selectedStaffData.name}</span>
                                    <span className="text-gray-400 mx-2">|</span>
                                    <span className="font-medium">
                                        {creationType === 'date' ? selectedDate : selectedDay}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {(selectedStaff && (creationType === 'date' ? selectedDate : selectedDay)) && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Time Slots</h2>
                                    <p className="text-sm text-gray-500">
                                        {creationType === 'date'
                                            ? format(new Date(selectedDate), "EEEE, MMMM d, yyyy")
                                            : `Every ${selectedDay}`}
                                    </p>
                                </div>
                                <PermissionGate resource="staffSlots" action="create">
                                    <button
                                        onClick={openModal}
                                        className="px-4 py-2 text-sm bg-blue-900 text-white rounded-lg hover:bg-blue-800 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create New Slot
                                    </button>
                                </PermissionGate>
                            </div>

                            {message && (
                                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {message.text}
                                </div>
                            )}

                            {loading ? (
                                <div className="text-center py-8 text-gray-500">Loading slots...</div>
                            ) : slots.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No slots created yet. Click "Create New Slot" to add a time slot.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
                                        {slots.map((slot, index) => (
                                            <div
                                                key={index}
                                                className={`p-3 border rounded-lg transition-all ${slot.isAvailable
                                                    ? 'border-green-200 bg-green-50/50'
                                                    : 'border-gray-200 bg-gray-50 opacity-60'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className={`w-4 h-4 ${slot.isAvailable ? 'text-green-600' : 'text-gray-400'}`} />
                                                        <span className="font-bold text-gray-900">
                                                            {slot.startTime} - {slot.endTime}
                                                        </span>
                                                    </div>
                                                    <PermissionGate resource="staffSlots" action="delete">
                                                        <button
                                                            onClick={() => removeSlot(index)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </PermissionGate>
                                                </div>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-xs text-gray-500">{slot.slotDuration} min</span>
                                                    <button
                                                        onClick={() => toggleSlotAvailability(index)}
                                                        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${slot.isAvailable
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-200 text-gray-600'}`}
                                                    >
                                                        {slot.isAvailable ? 'Available' : 'Unavailable'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <PermissionGate resource="staffSlots" action="edit">
                                            <FormButton
                                                onClick={handleSave}
                                                loading={saving}
                                                className="bg-blue-900 hover:bg-blue-800"
                                            >
                                                <Save className="w-4 h-4 mr-2" />
                                                Save All Slots
                                            </FormButton>
                                        </PermissionGate>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!selectedStaff && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="text-center py-8 text-gray-500">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Please select a staff member and date/day to manage availability slots</p>
                            </div>
                        </div>
                    )}

                    <Modal isOpen={isModalOpen} onClose={closeModal} title="Create Time Slots">
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Template:</strong> Multiple slots will be created for <strong>{creationType === 'date' ? selectedDate : selectedDay}</strong>.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormInput
                                    label="Start Time"
                                    type="time"
                                    required
                                    value={slotForm.startTime}
                                    onChange={(e: any) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                                />
                                <FormInput
                                    label="End Time"
                                    type="time"
                                    required
                                    value={slotForm.endTime}
                                    onChange={(e: any) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                                />
                            </div>
                            <FormInput
                                label="Slot Duration (minutes)"
                                type="number"
                                min="15"
                                step="15"
                                required
                                value={slotForm.slotDuration}
                                onChange={(e: any) => setSlotForm({ ...slotForm, slotDuration: parseInt(e.target.value) || 30 })}
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isAvailable"
                                    checked={slotForm.isAvailable}
                                    onChange={(e: any) => setSlotForm({ ...slotForm, isAvailable: e.target.checked })}
                                    className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                                />
                                <label htmlFor="isAvailable" className="text-sm text-gray-700">Mark as available for booking</label>
                            </div>
                            <FormInput
                                label="Notes (Optional)"
                                value={slotForm.notes}
                                onChange={(e: any) => setSlotForm({ ...slotForm, notes: e.target.value })}
                                placeholder="Add any notes"
                            />
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <FormButton
                                    onClick={handleAddSlot}
                                    className="bg-blue-900 hover:bg-blue-800"
                                >
                                    Create Slots
                                </FormButton>
                            </div>
                        </div>
                    </Modal>
                </div>
            </div>
        </PermissionGate>
    );
}

