import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui/popover";
import { Calendar } from "src/components/ui/calendar";

export default function DateInputField({ value, onChange, className, placeholder }) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={`flex items-center justify-between text-left transition-colors ${className || ""}`}
        onClick={(e) => {
           e.stopPropagation();
           e.preventDefault();
           setOpen(!open);
        }}
      >
        {dateObj ? format(dateObj, "dd - MMM - yyyy") : <span className="text-slate-500 font-normal">{placeholder || "Select date..."}</span>}
        <div className="flex items-center space-x-1 shrink-0 ml-1">
           {dateObj && (
              <div
                role="button"
                tabIndex={0}
                className="hover:bg-slate-800 p-0.5 rounded cursor-pointer text-slate-400 hover:text-red-400"
                onClick={(e) => {
                   e.stopPropagation();
                   e.preventDefault();
                   onChange("");
                   setOpen(false);
                }}
              >
                <X size={12} />
              </div>
           )}
           <CalendarIcon size={12} className="text-slate-400" />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-slate-950 border border-slate-800 text-slate-200" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(d) => {
            if (d) {
               const yyyy = d.getFullYear();
               const mm = String(d.getMonth() + 1).padStart(2, "0");
               const dd = String(d.getDate()).padStart(2, "0");
               onChange(`${yyyy}-${mm}-${dd}`);
            } else {
               onChange("");
            }
            setOpen(false);
          }}
          initialFocus
          className="bg-slate-950 text-slate-200"
          classNames={{
            day_selected: "bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-600 focus:text-white",
            day_today: "bg-slate-800 text-emerald-400",
            head_cell: "text-slate-400 font-medium text-[0.8rem]",
            nav_button: "text-slate-400 hover:text-slate-200",
          }}
        />
      </PopoverContent>
    </Popover>
  );
} 
