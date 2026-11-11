type PickerView = {
  setIncludeFolders: (include: boolean) => PickerView;
  setMimeTypes: (types: string) => PickerView;
  setMode: (mode: string) => PickerView;
};
type PickerResponse = { action: string; docs?: { id?: string }[] };
type PickerDialog = { setVisible: (visible: boolean) => void; dispose: () => void };
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilder;
  build: () => PickerDialog;
};
type PickerApi = {
  DocsView: new (view: string) => PickerView;
  DocsViewMode: { LIST: string };
  ViewId: { DOCS: string };
  Feature: { MULTISELECT_ENABLED: string };
  Action: { PICKED: string; CANCEL: string; ERROR: string };
  PickerBuilder: new () => PickerBuilder;
};
type PickerWindow = Window & {
  gapi?: { load: (library: string, config: { callback: () => void; onerror: () => void; ontimeout: () => void; timeout: number }) => void };
  google?: { picker?: PickerApi };
};

export type DrivePickerConfig = { apiKey: string; appId: string };
export const driveDocumentTypes = ["application/pdf", "image/jpeg", "image/png"];

let loading: Promise<PickerApi> | undefined;
function loadPicker(): Promise<PickerApi> {
  const browser = window as PickerWindow;
  if (browser.google?.picker) return Promise.resolve(browser.google.picker);
  loading ??= new Promise<PickerApi>((resolve, reject) => {
    const failed = () => reject(new Error("Não foi possível carregar o seletor do Google Drive."));
    const load = () => {
      if (!browser.gapi) return failed();
      browser.gapi.load("picker", {
        callback: () => browser.google?.picker ? resolve(browser.google.picker) : failed(),
        onerror: failed, ontimeout: failed, timeout: 10000,
      });
    };
    if (browser.gapi) load();
    else {
      const script = document.createElement("script");
      const timer = window.setTimeout(() => { script.remove(); failed(); }, 10000);
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => { window.clearTimeout(timer); load(); };
      script.onerror = () => { window.clearTimeout(timer); script.remove(); failed(); };
      document.head.appendChild(script);
    }
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export async function chooseDriveFiles(
  config: DrivePickerConfig, authorization: Promise<string>, signal: AbortSignal,
  { multiple = false, mimeTypes = driveDocumentTypes }: { multiple?: boolean; mimeTypes?: string[] } = {},
) {
  const [api, token] = await Promise.all([loadPicker(), authorization]);
  if (signal.aborted) return null;
  const view = new api.DocsView(api.ViewId.DOCS).setIncludeFolders(true)
    .setMode(api.DocsViewMode.LIST).setMimeTypes(mimeTypes.join(","));
  return new Promise<{ ids: string[]; token: string } | null>((resolve, reject) => {
    let dialog: PickerDialog | undefined;
    function close() {
      signal.removeEventListener("abort", abort);
      dialog?.dispose();
    }
    function abort() {
      close();
      resolve(null);
    }
    const builder = new api.PickerBuilder().addView(view)
      .setOAuthToken(token).setDeveloperKey(config.apiKey).setAppId(config.appId)
      .setOrigin(window.location.origin).setTitle("Escolher do Google Drive")
      .setCallback(response => {
        if (response.action === api.Action.CANCEL) return abort();
        if (response.action === api.Action.PICKED) {
          close();
          const ids = response.docs?.map(file => file.id) ?? [];
          if (ids.length > (multiple ? 2 : 1)) reject(new Error("Escolhe até dois ficheiros do mesmo documento."));
          else if (ids.length && ids.every((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(id))) resolve({ ids, token });
          else reject(new Error("O Drive não devolveu um ficheiro válido."));
        } else if (response.action === api.Action.ERROR) {
          close();
          reject(new Error("Não foi possível abrir o seletor do Google Drive."));
        }
      });
    if (multiple) builder.enableFeature(api.Feature.MULTISELECT_ENABLED);
    dialog = builder.build();
    signal.addEventListener("abort", abort, { once: true });
    try { dialog.setVisible(true); }
    catch (error) { close(); reject(error); }
  });
}
