import { tinaField } from "tinacms/dist/react";
import { Card } from "@/app/(home)/components/ui/card";

interface AboutSSWCardProps {
  data?: any;
}

export default function AboutSSWCard({ data }: AboutSSWCardProps) {
  return (
    <Card title={data?.title || "About SSW"}>
      <p data-tina-field={tinaField(data, "body")}>
        {data?.body ||
          "SSW Consulting has over 30 years of experience developing awesome Microsoft solutions that today build on top of Angular, React, Azure, Azure DevOps, SharePoint, Office 365, .NET Core, WebAPI, Dynamics 365, and SQL Server. With 40+ consultants in 5 countries, we have delivered the best in the business to more than 1,000 clients in 15 countries."}
      </p>
    </Card>
  );
}
