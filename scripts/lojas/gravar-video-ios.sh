#!/usr/bin/env bash
# Grava o vídeo que a Apple pede na revisão (diretriz 2.1): o app abrindo no iPhone e o uso
# típico, percorrido sozinho pelo Maestro num iPhone simulado do Codemagic.
#
# Uso: gravar-video-ios.sh <workspace .xcworkspace> <roteiro Maestro .yaml> <pasta de saída>
# Login do revisor: REVISOR_EMAIL e REVISOR_SENHA (grupo seguro "revisor_apple" no Codemagic).
# Nada aqui assina, envia ou publica: o resultado são só artefatos (vídeo e capturas).
set -euo pipefail

WORKSPACE="$1"
ROTEIRO="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
SAIDA="$3"
mkdir -p "$SAIDA"
SAIDA="$(cd "$SAIDA" && pwd)"

echo "== Compilando para o simulador"
xcodebuild \
  -workspace "$WORKSPACE" -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/sim CODE_SIGNING_ALLOWED=NO \
  build | tail -n 5
APP=/tmp/sim/Build/Products/Debug-iphonesimulator/App.app
[ -d "$APP" ] || { echo "App.app não encontrado"; exit 1; }

echo "== Escolhendo o iPhone simulado (iOS mais novo)"
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
d = json.load(sys.stdin)["devices"]
def ver(k):
    m = re.search(r"iOS-(\d+)-(\d+)", k)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
ios = sorted([k for k in d if "iOS" in k and d[k]], key=ver, reverse=True)
for k in ios:
    fones = [x for x in d[k] if x["name"].startswith("iPhone") and "SE" not in x["name"]]
    pro = [x for x in fones if x["name"].endswith("Pro")]
    esc = (pro or fones)
    if esc:
        print(esc[0]["udid"]); sys.stderr.write(k + " / " + esc[0]["name"] + "\n"); break
')
[ -n "$UDID" ] || { echo "Nenhum iPhone simulado disponível"; exit 1; }

echo "== Ligando o simulador em português"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl spawn "$UDID" defaults write "Apple Global Domain" AppleLanguages -array pt-BR
xcrun simctl spawn "$UDID" defaults write "Apple Global Domain" AppleLocale -string pt_BR
xcrun simctl shutdown "$UDID"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 || true
xcrun simctl install "$UDID" "$APP"

echo "== Instalando o Maestro"
curl -fsSL "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version

echo "== Gravando"
xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$SAIDA/video.mp4" &
GRAVADOR=$!
sleep 3
cd "$SAIDA"
set +e
maestro --device "$UDID" test \
  -e REVISOR_EMAIL="${REVISOR_EMAIL:-}" -e REVISOR_SENHA="${REVISOR_SENHA:-}" \
  --debug-output "$SAIDA/maestro" "$ROTEIRO"
RESULTADO=$?
if [ "$RESULTADO" -ne 0 ]; then
  # Mostra no log os textos que estavam na tela quando o roteiro parou (sem e-mails).
  echo "== Textos na tela quando o roteiro parou"
  maestro --device "$UDID" hierarchy 2>/dev/null | python3 -c '
import json, sys
vistos = []
def andar(n):
    a = n.get("attributes", {}) if isinstance(n, dict) else {}
    for k in ("accessibilityText", "text", "hintText"):
        v = (a.get(k) or "").strip()
        if v and "@" not in v and v not in vistos:
            vistos.append(v)
    for f in (n.get("children") or []) if isinstance(n, dict) else []:
        andar(f)
try:
    andar(json.load(sys.stdin))
except Exception as e:
    print("sem hierarquia:", e)
for v in vistos[:120]:
    print(" |", v[:80])
' || true
fi
set -e
sleep 2
kill -INT "$GRAVADOR"
wait "$GRAVADOR" || true
ls -la "$SAIDA"
echo "$RESULTADO" > "$SAIDA/resultado.txt"
echo "Roteiro terminou com código $RESULTADO (0 = percorreu tudo). O vídeo fica nos artefatos de qualquer jeito."
