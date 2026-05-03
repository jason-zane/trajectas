import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/client/*",
      method: "GET",
    },
  ],
});
