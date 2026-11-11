"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {authorizeDrive, downloadDriveFile, loadGoogle} from "@/lib/crm-drive-client";
import {chooseDriveFiles, type DrivePickerConfig} from "@/lib/crm-drive-picker";
import {identityFileLimit, identityFileTypes, scanClientDocument} from "@/lib/crm-document-scan";
import {lisbonDay} from "@/lib/crm-calendar";
import {identityFieldLabels, missingIdentityFields, type DocumentReading} from "@/lib/crm-document-ocr";
import {officeInput as input,officeButton as primary,officeSecondary as secondary,type AuthorizedFetch} from "@/lib/crm-office-types";

type ClientIdentity={id:string;full_name:string;birth_date?:string|null;updated_at:string};
type SavedScan={client:ClientIdentity;document:{id:string;client_id:string;document_type:"passport"|"identity_card";document_number:string;expires_on:string;created_at:string;updated_at:string}};
const nameKey=(name:string)=>name.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z]/g,"");
const field="block space-y-1 text-sm font-medium";

type ScannerProps =
  | { client: ClientIdentity; authorizedFetch: AuthorizedFetch; onSaved: (result: SavedScan) => void }
  | { authorizedFetch: AuthorizedFetch; onRead: (reading: DocumentReading) => void; onScanning: (scanning: boolean) => void; disabled?: boolean };

export default function CrmDocumentScanner(props: ScannerProps) {
  const client = "client" in props ? props.client : null;
  const disabled = "disabled" in props && props.disabled;
  const [open,setOpen]=useState(false);
  const [reading,setReading]=useState<DocumentReading|null>(null);
  const [progress,setProgress]=useState("");
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [scanning,setScanning]=useState(false);
  const [driveConfig, setDriveConfig] = useState<{clientId: string; picker: DrivePickerConfig} | null>(null);
  const [driveError, setDriveError] = useState("");
  const { authorizedFetch } = props;
  const fileInput=useRef<HTMLInputElement>(null);
  const controller=useRef<AbortController|null>(null);
  const reviewedRevision=useRef("");
  useEffect(()=>()=>controller.current?.abort(),[]);

  useEffect(() => {
    if (!open || driveConfig) return;
    let active = true;
    authorizedFetch("/api/crm/drive?picker=1").then(async response => {
      if (!response.ok) throw new Error("Não foi possível carregar o seletor do Drive.");
      const config = await response.json();
      if (!config.clientId || !config.picker) throw new Error("A seleção do Drive está indisponível.");
      await loadGoogle();
      if (active) setDriveConfig(config);
    }).catch(cause => { if (active) setDriveError(cause.message); });
    return () => { active = false; };
  }, [open, driveConfig, authorizedFetch]);

  async function scan(getFiles: (signal: AbortSignal) => File[] | null | Promise<File[] | null>) {
    if (controller.current || saving || disabled) return;
    setSaved(false);setError("");setScanning(true);
    if ("onScanning" in props) props.onScanning(true);
    const request=new AbortController();
    controller.current=request;
    let timer: number | undefined;
    try {
      const files = await getFiles(request.signal);
      if (!files || request.signal.aborted) return;
      setReading(null);
      reviewedRevision.current=client?.updated_at ?? "";
      timer=window.setTimeout(()=>request.abort(),120000);
      const result=await scanClientDocument(files,request.signal,setProgress);
      if(request.signal.aborted) return;
      if (missingIdentityFields(result).length === Object.keys(identityFieldLabels).length) {
        setError("A leitura terminou sem encontrar dados. Tenta uma imagem mais nítida ou inclui a face com os dados do documento.");
        return;
      }
      if (client && result.full_name && nameKey(result.full_name) === nameKey(client.full_name)) result.full_name = client.full_name;
      if ("onRead" in props) {
        props.onRead(result);
        setOpen(false);
        setSaved(true);
      } else setReading(result);
    } catch(cause) {
      setError(request.signal.aborted?"A leitura foi interrompida.":cause instanceof Error?cause.message:"Não foi possível ler o documento.");
    } finally {
      window.clearTimeout(timer);
      request.abort();
      controller.current=null;
      setScanning(false);setProgress("");
      if ("onScanning" in props) props.onScanning(false);
    }
  }

  function scanLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = Array.from(fileInput.current?.files || []);
    if (fileInput.current) fileInput.current.value = "";
    void scan(() => files);
  }

  function scanDrive() {
    if (!driveConfig) return;
    const { clientId, picker } = driveConfig;
    void scan(async signal => {
      setProgress("A abrir o Google Drive…");
      const selection = await chooseDriveFiles(picker, authorizeDrive(clientId, signal), signal, {
        multiple: true, mimeTypes: identityFileTypes,
      });
      if (!selection) return null;
      setProgress("A preparar os ficheiros do Drive para leitura…");
      return Promise.all(selection.ids.map(id => downloadDriveFile(selection.token, id, identityFileTypes, identityFileLimit, signal)));
    });
  }

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!("client" in props)) return;
    const { client, authorizedFetch, onSaved } = props;
    const form=new FormData(event.currentTarget);
    setSaving(true);setError("");
    try {
      const response=await authorizedFetch("/api/crm/documents/scan",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({client_id:client.id,expected_updated_at:reviewedRevision.current,
          reviewed:form.get("reviewed")==="on",document_type:form.get("document_type"),full_name:form.get("full_name"),
          birth_date:form.get("birth_date"),expires_on:form.get("expires_on"),document_number:form.get("document_number")})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Não foi possível guardar o documento.");
      onSaved(result);
      setReading(null);setSaved(true);setOpen(false);
    } catch(cause) {setError(cause instanceof Error?cause.message:"Não foi possível guardar.");}
    finally {setSaving(false);}
  }

  const unread = reading ? missingIdentityFields(reading) : [];

  return <div className="my-3 space-y-3">
    <button type="button" aria-expanded={open} className={secondary} disabled={disabled || saving || scanning}
      onClick={()=>{if(open){controller.current?.abort();setReading(null);}setError("");setDriveError("");setSaved(false);setOpen(!open);}}>
      {open?"Fechar leitura":"Ler passaporte ou Cartão de Cidadão"}
    </button>
    {saved&&<p role="status" className="text-sm text-orange-800">{client ? "Documento e ficha do cliente guardados." : "Leitura concluída. Confirma os campos no formulário."}</p>}
    {open&&<div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <form onSubmit={scanLocal} className="space-y-3">
        <label className={field}>Fotografias ou PDF do documento
          <input ref={fileInput} type="file" required multiple disabled={disabled||scanning||saving} accept={identityFileTypes.join(",")} className={input}/>
        </label>
        <p className="text-xs text-slate-500">Até duas faces ou páginas, 15 MB por ficheiro. A leitura é feita neste navegador.</p>
        <div className="flex flex-wrap gap-2">
          <button className={primary} disabled={disabled||scanning||saving}>Ler documento</button>
          <button type="button" className={secondary} disabled={disabled || scanning || saving || !driveConfig} onClick={scanDrive}>Escolher do Google Drive</button>
          {scanning&&<button type="button" className={secondary} onClick={()=>controller.current?.abort()}>Interromper</button>}
        </div>
      </form>
      {driveError && <p className="text-xs text-slate-600">{driveError} Podes usar um ficheiro do dispositivo.</p>}
      {progress&&<p role="status" className="text-sm">{progress}</p>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {reading&&client&&<form onSubmit={save} className="space-y-3 border-t border-slate-200 pt-4">
        <p className="text-sm font-semibold">Confirma os dados de {client.full_name}</p>
        {unread.length > 0 && <p role="status" className="text-sm text-amber-800">Confirma no documento e preenche os campos por ler ({unread.join(", ")}).</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>Tipo<select name="document_type" defaultValue={reading.document_type||""} required className={input}>
            <option value="">Seleciona</option><option value="passport">Passaporte</option><option value="identity_card">Cartão de Cidadão</option>
          </select></label>
          <label className={field}>Número/ID<input name="document_number" maxLength={80} defaultValue={reading.document_number} required className={input}/></label>
          <label className={field+" sm:col-span-2"}>Nome completo<input name="full_name" minLength={2} maxLength={160} defaultValue={reading.full_name} required className={input}/></label>
          <label className={field}>Data de nascimento<input name="birth_date" type="date" max={lisbonDay(new Date().toISOString())} defaultValue={reading.birth_date} required className={input}/></label>
          <label className={field}>Validade<input name="expires_on" type="date" defaultValue={reading.expires_on} required className={input}/></label>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input name="reviewed" type="checkbox" required className="mt-0.5 size-[18px] shrink-0 appearance-auto accent-orange-800"
            onInvalid={event => event.currentTarget.setCustomValidity("Assinala esta caixa para confirmar os dados antes de guardar.")}
            onChange={event => event.currentTarget.setCustomValidity("")}/>
          <span>Confirmei que o documento pertence a este cliente e que os dados estão certos. *</span>
        </label>
        <p className="text-xs text-slate-500">Ao guardar, o nome e a data de nascimento são atualizados na ficha. Se o documento já existir, é atualizada a validade.</p>
        <button className={primary} disabled={saving}>{saving?"A guardar…":"Guardar documento e ficha"}</button>
      </form>}
    </div>}
  </div>;
}
