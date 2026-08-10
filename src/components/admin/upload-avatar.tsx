import { useState, useCallback } from "react";
import { User, Upload, Loader2, X, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { otimizarImagem } from "@/lib/imagem";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImg } from "@/lib/crop-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface UploadAvatarProps {
  currentUrl: string | null;
  onUploadComplete: (url: string) => void;
  userId?: string;
}

export function UploadAvatar({ currentUrl, onUploadComplete, userId }: UploadAvatarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Por favor, selecione uma imagem válida.");
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImageToCrop(reader.result as string);
    });
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  }

  async function handleSaveCrop() {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      setIsUploading(true);
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Falha ao recortar a imagem.");

      const file = new File([croppedImageBlob], "avatar.webp", { type: "image/webp" });
      const imagem = await otimizarImagem(file);
      const fileExt = "webp";
      const owner = userId || crypto.randomUUID();
      const filePath = `${owner}/avatar-${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, imagem, { contentType: imagem.type, cacheControl: "31536000" });

      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await supabase.storage
        .from("avatars")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      if (signError || !signed?.signedUrl) {
        throw signError ?? new Error("Falha ao carregar a foto.");
      }
      onUploadComplete(signed.signedUrl);
      toast.success("Foto carregada com sucesso!");
      setImageToCrop(null);
    } catch (error: unknown) {
      console.error("Erro no upload:", error);
      toast.error(
        "Erro ao fazer upload da imagem: " +
          (error instanceof Error ? error.message : "Tente novamente"),
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="group relative h-32 w-32 overflow-hidden rounded-full border-4 border-background bg-muted shadow-xl ring-2 ring-primary/10 transition-all hover:ring-primary/30">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt="Avatar"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/20">
            <User className="h-16 w-16" />
          </div>
        )}

        <label
          htmlFor="avatar-upload"
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Upload className="h-8 w-8 text-white" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Upload
          </span>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>

        {currentUrl && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            onClick={() => onUploadComplete("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">
        <Move className="h-3 w-3" />
        Arraste para ajustar o melhor ângulo
      </p>

      <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && setImageToCrop(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
          </DialogHeader>

          <div className="relative mt-4 h-[300px] w-full overflow-hidden rounded-lg bg-black">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground italic">
              Arraste a foto acima para centralizar no melhor ângulo
            </p>
          </div>

          <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setImageToCrop(null)} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCrop} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Foto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
