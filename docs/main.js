import { compress, decompress } from "./compress.js";
import {
  outputAlphabetASCII,
  outputAlphabetQR,
  outputAlphabetEmoji
} from "./alphabets.js";

let qrGenerate, qrMode, qrCorrection;

let domain = window.location.hostname;
const webPort = window.location.port;
if (webPort && webPort !== "80" && webPort !== "443") {
  domain += `:${webPort}`;
}

var settings = {
  emoji: false,
  qr: false,
  https: true
};

const settingsElements = {
  emoji: "#settings-emoji",
  qr: "#settings-qr",
  https: "#settings-https"
};

for (const setting in settingsElements) {
  const element = document.querySelector(settingsElements[setting]);
  if (element) {
    settings[setting] = element.checked;
    element.addEventListener("change", (event) => {
      settings[setting] = element.checked;
      updateOutput();
    });
  }
}

function countSymbols (string, alphabet) {
  let count = 0;
  while (string) {
    const symbol = alphabet.find(c => string.endsWith(c));
    string = string.slice(0, symbol ? -symbol.length : -1);
    count ++;
  }
  return count;
}

const inputLinkElement = document.querySelector("#input-link");
const clearInputBtn = document.querySelector("#clear-input-btn");
const outputLinkElement = document.querySelector("#output-link");
const outputRatioElement = document.querySelector("#output-ratio");
const queryWarningElement = document.querySelector("#query-warning");

const qrCodeImage = document.querySelector("#qrcode");
const qrWrapper = document.querySelector("#qr-wrapper");
const qrCodeCorrectionLevelContainer = document.querySelector("#qr-correct-level-container");
const qrCodeCorrectionLevelElement = document.querySelector("#qr-correct-level");
const qrLevelValElement = document.querySelector("#qr-level-val");
const downloadQrBtn = document.querySelector("#download-qr-btn");
const copyBtn = document.querySelector("#copy-btn");

const qrLevelMap = ["L (7%)", "M (15%)", "Q (25%)", "H (30%)"];

if (qrCodeCorrectionLevelElement) {
  qrCodeCorrectionLevelElement.addEventListener("input", () => {
    if (qrLevelValElement) {
      qrLevelValElement.textContent = qrLevelMap[qrCodeCorrectionLevelElement.value] || "";
    }
    updateOutput();
  });
}

if (clearInputBtn) {
  clearInputBtn.addEventListener("click", () => {
    inputLinkElement.value = "";
    clearInputBtn.style.display = "none";
    inputLinkElement.focus();
    updateOutput();
  });
}

if (inputLinkElement) {
  inputLinkElement.addEventListener("input", () => {
    if (clearInputBtn) {
      clearInputBtn.style.display = inputLinkElement.value ? "flex" : "none";
    }
    updateOutput();
  });
}

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const textToCopy = outputLinkElement.href || outputLinkElement.textContent;
    if (textToCopy && outputLinkElement.hasAttribute("href")) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        const actionText = copyBtn.querySelector(".action-text");
        if (actionText) actionText.textContent = "已复制 ✓";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          if (actionText) actionText.textContent = "复制";
          copyBtn.classList.remove("copied");
        }, 1800);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }
  });
}

if (downloadQrBtn) {
  downloadQrBtn.addEventListener("click", () => {
    if (qrCodeImage && qrCodeImage.style.display !== "none") {
      try {
        const link = document.createElement("a");
        link.download = `qrcode_${Date.now()}.png`;
        link.href = qrCodeImage.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("QR download failed:", err);
      }
    }
  });
}

function updateOutput () {
  const input = inputLinkElement.value.trim();
  try {
    const alphabet = settings.emoji ? outputAlphabetEmoji : outputAlphabetASCII;
    const output = compress(input, alphabet);

    const hasProtocol = input.match(/\w+:\/\//); 
    const url = new URL(hasProtocol ? input : "http://" + input);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Invalid protocol: ${url.protocol}. Only http and https are supported.`);
    }

    if (url.username || url.password) {
      throw new Error(`Credentials in URL are not supported`);
    }

    let inputNormalized = input;
    const inputLower = input.toLowerCase();
    if (inputLower.startsWith("https://")) {
      inputNormalized = input.slice(8);
    } else if (inputLower.startsWith("http://")) {
      inputNormalized = input.slice(7);
    }
    let excessiveParams = false;
    if (URL.canParse("http://" + inputNormalized)) {
      const url = new URL("http://" + inputNormalized);
      if (url.searchParams.size > 1) {
        excessiveParams = true;
      }
    }
    if (queryWarningElement) {
      queryWarningElement.style.display = excessiveParams ? "block" : "none";
    }

    const ratio = (1 - (countSymbols(output, alphabet) + 6) / inputNormalized.length) * 100;
    if (ratio < -300) {
      outputRatioElement.textContent = `比原链接显著更长`;
      outputRatioElement.style.background = "var(--danger-bg)";
      outputRatioElement.style.color = "var(--danger)";
    } else if (ratio < 0) {
      outputRatioElement.textContent = `比原链接增长 ${Math.floor(-ratio)}%`;
      outputRatioElement.style.background = "var(--danger-bg)";
      outputRatioElement.style.color = "var(--danger)";
    } else if (ratio > 0) {
      outputRatioElement.textContent = `比原链接缩短 ${Math.ceil(ratio)}%`;
      outputRatioElement.style.background = "var(--success-bg)";
      outputRatioElement.style.color = "var(--success)";
    } else {
      outputRatioElement.textContent = "与原链接长度一致";
      outputRatioElement.style.background = "rgba(255, 255, 255, 0.08)";
      outputRatioElement.style.color = "var(--text-muted)";
    }

    const outputScheme = settings.https ? "https" : "http";
    const fullOutputLink = `${outputScheme}://${domain}#${output}`;
    outputLinkElement.textContent = fullOutputLink;
    outputLinkElement.href = fullOutputLink;
    outputLinkElement.style.color = "";

    const linkToMe = url.host === domain && url.pathname === "/" && url.hash === "" && url.search === "";
    if (linkToMe) {
      outputRatioElement.textContent = `这是本站首页`;
      outputRatioElement.style.background = "var(--success-bg)";
      outputRatioElement.style.color = "var(--success)";
      outputLinkElement.textContent = `${outputScheme}://${domain}`;
      outputLinkElement.href = `${outputScheme}://${domain}`;
      outputLinkElement.style.color = "";
    }

    if (settings.qr) {
      if (!qrGenerate) {
        import("./lean-qr/lean-qr.js").then((module) => {
          qrGenerate = module.generate;
          qrMode = module.mode;
          qrCorrection = module.correction;
          updateOutput();
        });
        return;
      }

      const correctionLevels = [qrCorrection.L, qrCorrection.M, qrCorrection.Q, qrCorrection.H];

      if (qrCodeImage) qrCodeImage.style.display = "block";
      if (qrWrapper) qrWrapper.style.display = "flex";
      if (qrCodeCorrectionLevelContainer) qrCodeCorrectionLevelContainer.style.display = "block";

      const qrCodeDomain = domain.toUpperCase();
      const qrCodeScheme = settings.https ? "HTTPS" : "HTTP";
      let qrCodeLink = `${qrCodeScheme}://${qrCodeDomain}/${compress(input, outputAlphabetQR)}`;
      if (linkToMe) {
        qrCodeLink = `${qrCodeScheme}://${qrCodeDomain}`;
      }

      const errorCorrection = correctionLevels[qrCodeCorrectionLevelElement.value];

      const qr = qrGenerate(
        qrMode.alphaNumeric(qrCodeLink),
        {
          minVersion: 1,
          maxVersion: 40,
          minCorrectionLevel: errorCorrection,
          maxCorrectionLevel: qrCorrection.H,
        });

      qr.toCanvas(qrCodeImage,
        {
          on:  [0x00, 0x00, 0x00, 0xFF], // black
          off: [0xFF, 0xFF, 0xFF, 0xFF], // white
          pad: 2,
        }
      );
      qrCodeImage.style.width = `${(qr.size + 8) * 8}px`;
      qrCodeImage.style.height = `${(qr.size + 8) * 8}px`;
      qrCodeImage.title = qrCodeLink;

    } else {
      if (qrCodeImage) qrCodeImage.style.display = "none";
      if (qrWrapper) qrWrapper.style.display = "none";
      if (qrCodeCorrectionLevelContainer) qrCodeCorrectionLevelContainer.style.display = "none";
    }
  } catch (e) {
    if (!input.trim()) {
      outputLinkElement.textContent = "在上方输入链接以生成结果";
      outputRatioElement.textContent = "";
      outputRatioElement.style.background = "transparent";
    } else {
      outputLinkElement.textContent = "无效的链接格式 (需以 http:// 或 https:// 开头)";
      outputLinkElement.style.color = "var(--danger)";
      outputRatioElement.textContent = "";
      outputRatioElement.style.background = "transparent";
      console.error(e);
    }
    if (qrCodeImage) qrCodeImage.style.display = "none";
    if (qrWrapper) qrWrapper.style.display = "none";
    if (qrCodeCorrectionLevelContainer) qrCodeCorrectionLevelContainer.style.display = "none";
    outputLinkElement.removeAttribute("href");
    if (queryWarningElement) queryWarningElement.style.display = "none";
  }
}

const loaderElement = document.querySelector("#loader");

(() => {
  let payload = null;
  let alphabet = outputAlphabetASCII;

  if (window.location.hash) {
    payload = decodeURIComponent(window.location.hash.slice(1));
    payload = payload.replaceAll(" ", "");
    const useEmoji = Array.from(payload).some(c => !outputAlphabetASCII.includes(c));
    alphabet = useEmoji ? outputAlphabetEmoji : outputAlphabetASCII;
  } else {
    payload = decodeURIComponent(window.location.pathname.slice(1));
    alphabet = outputAlphabetQR;
  }

  if (payload && payload.trim()) {
    try {
      const target = decompress(payload, alphabet);
      if (target) {
        window.location.replace(target);
        return;
      }
    } catch (e) {
      console.warn(`Redirect failed. Could not decode input.`);
      console.error(e);
    }
  }

  updateOutput();

  if (loaderElement) loaderElement.style.opacity = 0;
  const contentEl = document.querySelector("#content");
  if (contentEl) {
    contentEl.style.opacity = 1;
    contentEl.style.pointerEvents = "auto";
  }
  const headerEl = document.querySelector("header");
  if (headerEl) {
    headerEl.style.opacity = 1;
    headerEl.style.pointerEvents = "auto";
  }
})();
