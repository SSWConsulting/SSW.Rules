"use client";

import React, { useState } from "react";
import { tinaField } from "tinacms/dist/react";
import { Card } from "@/components/ui/card";
import JobFormEmbed from "./JobFormEmbed";

interface HelpCardProps {
  data?: any;
}

const HelpCard: React.FC<HelpCardProps> = ({ data }) => {
  const [open, setOpen] = useState(false);

  const handleOpenForm = () => {
    setOpen(true);
  };

  return (
    <Card title={data?.title || "Need help?"}>
      <p className="text-gray-700 mb-6" data-tina-field={tinaField(data, "description")}>
        {data?.description || "SSW Consulting has over 30 years of experience developing awesome software solutions."}
      </p>
      <button
        onClick={() => handleOpenForm()}
        className="w-full bg-ssw-red text-white py-3 px-4 rounded hover:bg-ssw-red/90 transition hover:cursor-pointer"
        data-tina-field={tinaField(data, "buttonText")}
      >
        {data?.buttonText || "Book a free initial meeting"}
      </button>
      <JobFormEmbed jotFormId={data?.jotFormId || "233468468973070"} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
};

export default HelpCard;
