document.addEventListener("DOMContentLoaded", function () {
  const API_BASE = "http://localhost:2616/api/sign";

  const dongleSelect = document.getElementById('dongleSelect');
  const dongleLoadButton = document.getElementById('dongleLoadButton');

  const pinInput = document.getElementById('pin');
  const togglePinVisibilityButton = document.getElementById("togglePinVisibility");
  const openSessionButton = document.getElementById("openSessionButton");

  const islemKoduInput = document.getElementById('islemKodu');
  const fileInput = document.getElementById('fileInput');
  const signButton = document.getElementById("signButton");

  let sessionState = false;

  async function fetchHealthCheck() {
    try {
      const response = await fetch(`${API_BASE}/healthcheck`);
      const result = await response.json();

      if (result.IsSuccessful) {
        dongleLoadButton.disabled = false;

        showMessage(result.Data, "success");
      } else {
        const errorMsg = result.Errors?.length ? result.Errors.join(", ") : "E-İmza servisine ulaşılamadı!";
        showMessage(errorMsg, "error", 10000);
      }
    } catch (error) {
      showMessage(`E-İmza servisine ulaşırken bir hata oluştu. Detay: ${error.message}`, "error", 10000);
    }
  }

  (async () => {
    await fetchHealthCheck();
  })();

  async function fetchDongleList() {
    dongleSelect.innerHTML = `<option value="" disabled selected>Dongle Seçin</option>`;

    try {
      const response = await fetch(`${API_BASE}/donglelist`);
      const result = await response.json();

      if (result.IsSuccessful && Array.isArray(result.Data) && result.Data.length > 0) {
        result.Data.forEach((dongle) => {
          const option = document.createElement("option");
          option.value = `${dongle.LibraryIndex}-${dongle.Slot}`;
          option.textContent = dongle.Text;
          dongleSelect.appendChild(option);
        });

        dongleSelect.disabled = false;
        pinInput.disabled = false;
        openSessionButton.disabled = false;

        showMessage("Dongle listesi başarıyla yüklendi.", "success");
      } else {
        const errorMsg = result.Errors?.length ? result.Errors.join(", ") : "Dongle listesi boş döndü.";
        showMessage(errorMsg, "error", 10000);
      }
    } catch (error) {
      showMessage(`Dongle listesi yüklenirken bir hata oluştu. Detay: ${error.message}`, "error", 10000);
    }
  }

  async function openSession() {
    const isDongleSelected = dongleSelect.value !== '';
    const isPinFilled = pinInput.value.trim() !== '';

    if (!isDongleSelected) {
      showMessage("Lütfen bir dongle seçin.", "error");
      return;
    }

    if (!isPinFilled) {
      showMessage("Lütfen PIN kodunu girin.", "error");
      return;
    }

    setLoadingState(openSessionButton, true);

    const [libraryIndex, slot] = dongleSelect.value.split("-");
    const pin = pinInput.value.trim();

    try {
      const response = await fetch(`${API_BASE}/opensession`, {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ LibraryIndex: libraryIndex, Slot: slot, Pin: pin }),
      });

      const result = await response.json();

      if (result.IsSuccessful || result.StatusCode === 256) {
        sessionState = true;
        openSessionButton.innerHTML = 'Oturumu Kapat';
        openSessionButton.disabled = false;
        islemKoduInput.disabled = false;
        fileInput.disabled = false;
        signButton.disabled = false;

        showMessage(result.Data || "Oturum başarıyla açıldı", "success");
      } else {
        showMessage(`Oturum Açılamadı: ${result.Errors.join(", ")}`, "error");
      }
    } catch (error) {
      showMessage(`Oturum açarken hata oluştu: ${error.message}`, "error");
    }

    setLoadingState(openSessionButton, false, sessionState ? "Oturumu Kapat" : "Oturumu Aç");
  }

  async function closeSession() {
    pinInput.value = "";
    islemKoduInput.disabled = true;
    signButton.disabled = true;

    setLoadingState(openSessionButton, true);

    try {
      const response = await fetch(`${API_BASE}/closesession`, { method: "POST" });
      const result = await response.json();

      if (result.IsSuccessful) {
        sessionState = false;
        openSessionButton.innerHTML = "Oturumu Aç";

        showMessage(result.Data || "Oturum başarıyla kapatıldı", "success");
      } else {
        showMessage(`Oturum kapatılamadı: ${result.Errors.join(", ")}`, "error");
      }
    } catch (error) {
      showMessage(`Oturum kapatırken hata oluştu: ${error.message}`, "error");
    }

    setLoadingState(openSessionButton, false, sessionState ? "Oturumu Kapat" : "Oturumu Aç");
  }

  togglePinVisibilityButton.addEventListener("click", () => {
    const isHidden = pinInput.type === "password";
    pinInput.type = isHidden ? "text" : "password";
    togglePinVisibilityButton.textContent = isHidden ? "🙈" : "👁️";
  });

  dongleLoadButton.addEventListener("click", async function () {
    setLoadingState(dongleLoadButton, true, "Yükleniyor...");
    await fetchDongleList();
    setLoadingState(dongleLoadButton, false, "Yükle");
  });

  openSessionButton.addEventListener("click", async function () {
    if (!sessionState) {
      await openSession();
    } else {
      await closeSession();
    }
  });

  signButton.addEventListener("click", async function () {
    const islemKodu = islemKoduInput.value.trim();
    const file = fileInput?.files?.[0];

    if (!islemKodu && !file) {
      showMessage("Lütfen işlem kodunu girin veya bir dosya yükleyin.", "error");
      return;
    }

    setLoadingState(signButton, true);

    try {
      signButton.innerHTML = '<div class="spinner"></div>';
      signButton.disabled = true;

      let response;

      if (islemKodu) {
        response = await fetch(`${API_BASE}/withislemkodu/${islemKodu}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
      } else if (file) {
        const base64 = await toBase64(file);

        response = await fetch(`${API_BASE}/withfile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Data: base64,
            FileName: file.name
          }),
        });
      }

      const result = await response.json();

      if (result.IsSuccessful) {
        showMessage(result.Data || "İmza başarılı.", "success");
      } else {
        showMessage(`İmza başarısız:: ${result.Errors.join(", ")}`, "error");
      }

    } catch (error) {
      showMessage(`İmzalama sırasında hata oluştu: ${error.message}`, "error");
    } finally {
      signButton.innerHTML = "İmzala";
      signButton.disabled = false;
    }

    setLoadingState(signButton, false, "İmzala");
  });

  function showMessage(content, type = "success", timeout = 4000) {
    const resultMessage = document.getElementById("resultMessage");
    const resultMessageContent = document.getElementById("resultMessageContent");
    const resultIcon = document.getElementById("resultIcon");

    resultMessage.classList.remove("success-style", "error-style", "visible");
    void resultMessage.offsetWidth; // Reflow for transition reset

    resultMessageContent.innerText = content;

    if (type === "success") {
      resultMessage.classList.add("success-style");
      resultIcon.innerHTML = `
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9 12l2 2 4-4"></path>
    `;
    } else {
      resultMessage.classList.add("error-style");
      resultIcon.innerHTML = `
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    `;
    }

    resultMessage.classList.add("visible");

    if (timeout > 0) {
      setTimeout(() => {
        resultMessage.classList.remove("visible");
      }, timeout);
    }
  }

  function setLoadingState(button, isLoading, text = "") {
    if (isLoading) {
      button.innerHTML = `<div class="spinner"></div>`;
      button.disabled = true;
    } else {
      button.innerHTML = text;
      button.disabled = false;
    }
  }

  function validateInputs() {
    const isDongleSelected = dongleSelect.value !== '';
    const isPinFilled = pinInput.value.trim() !== '';
    const isIslemKoduFilled = islemKoduInput.value.trim() !== '';
    const isFileSelected = fileInput.files.length > 0;

    signButton.disabled = !(isDongleSelected && isPinFilled && (isIslemKoduFilled || isFileSelected));
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = () => {
        const base64String = reader.result.split(',')[1]; // Sadece Base64 içeriği al
        resolve(base64String);
      };

      reader.onerror = error => reject(error);
    });
  }


  pinInput.addEventListener('input', validateInputs);
  dongleSelect.addEventListener('change', validateInputs);
  islemKoduInput.addEventListener('input', validateInputs);
});
