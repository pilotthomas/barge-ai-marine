import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Ship } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import DispatchForm from "../components/dispatches/DispatchForm";
import RecentDispatchList from "../components/dashboard/RecentDispatchList";

export default function Dispatches() {
  const [showForm, setShowForm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const queryClient = useQueryClient();

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-created_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Dispatch.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setShowForm(false);
      setEditingDispatch(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Dispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setShowForm(false);
      setEditingDispatch(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingDispatch) {
      updateMutation.mutate({ id: editingDispatch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (dispatch) => {
    setEditingDispatch(dispatch);
    setShowForm(true);
  };

  const filteredDispatches = dispatches.filter(d => 
    d.barge_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.captain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.origin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Dispatch Management
            </h1>
            <p className="text-slate-600">Create and track all barge deliveries</p>
          </div>
          <Button
            onClick={() => {
              setEditingDispatch(null);
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Dispatch
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <DispatchForm
                dispatch={editingDispatch}
                barges={barges}
                onSave={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingDispatch(null);
                }}
                isProcessing={createMutation.isPending || updateMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!showForm && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search dispatches by barge, captain, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-6 text-lg border-slate-200"
              />
            </div>

            <RecentDispatchList 
              dispatches={filteredDispatches}
              onDispatchClick={handleEdit}
            />
          </>
        )}
      </div>
    </div>
  );
}