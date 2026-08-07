import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {CurrencyRates} from "../types/currency.types";

export const currencyApi = {
  getRates: async (): Promise<CurrencyRates> =>
    (await apiClient.get<ApiResponse<CurrencyRates>>("/currency/rates")).data.data,
};
