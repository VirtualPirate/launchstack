import axios from "axios";

import { globalEnv } from "../env/config-env";

export const axiosInstance = axios.create({
  baseURL: globalEnv.apiBaseUri,
});
