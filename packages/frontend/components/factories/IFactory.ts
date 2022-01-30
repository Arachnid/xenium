import { NextPage } from "next";

export interface Props {
    factory: string;
    issuers: string[];
    onSubmit: () => void;  
}

export type Factory = NextPage<Props>;
