import { Form, TinaCMS, TinaField } from "tinacms";

export const historyFields:TinaField[] = [
    {
        type: "datetime",
        name: "created",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        label: "Created",
        ui: {
            component: "hidden",
        },
    },
    {
        type: "string",
        name: "createdBy",
        label: "Created By",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        ui: {
            component: "hidden",
        },
    },
    {
        type: "string",
        name: "createdByEmail",
        label: "Created By Email",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        ui: {
            component: "hidden",
        },
    },
    {
        type: "datetime",
        name: "lastUpdated",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        label: "Last Updated",
        ui: {
            component: "hidden",
        },
    },
    {
        type: "string",
        name: "lastUpdatedBy",
        label: "Last Updated By",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        ui: {
            component: "hidden",
        },
    },
    {
        type: "string",
        name: "lastUpdatedByEmail",
        label: "Last Updated By Email",
        description:
            "If you see this field, contact a dev immediately 😳 (should be a hidden field generated in the background).",
        ui: {
            component: "hidden",
        },
    },
];

export const historyBeforeSubmit = async ({
    form,
    cms,
    values,
}: {
    form: Form;
    cms: TinaCMS;
    values: Record<string, any>;
}) => {
    let userEmail: string | undefined;
    let userName: string | undefined;

    try {
        const user = await cms.api.tina?.authProvider?.getUser();
        if (user) {
            userEmail = user.email;
            userName = user.fullName;
        }
    } catch (err) {
        console.error("Auth error:", err);
        userEmail = undefined;
        userName = undefined;
    }

    if (form.crudType === "create") {
        return {
            ...values,
            created: new Date().toISOString(),
            createdBy: userName ?? "",
            createdByEmail: userEmail ?? "",
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: userName ?? "",
            lastUpdatedByEmail: userEmail ?? "",
        };
    }

    return {
        ...values,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: userName ?? "",
        lastUpdatedByEmail: userEmail ?? "",
    };
}