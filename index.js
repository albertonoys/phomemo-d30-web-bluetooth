"use strict";

import { drawText } from "https://cdn.jsdelivr.net/npm/canvas-txt@4.1.1/+esm";
import { printCanvas } from "./src/printer.js";

const $ = document.querySelector.bind(document);
const $all = document.querySelectorAll.bind(document);

const labelSize = { width: 40, height: 12 };
let printerCharacteristic = null;

const addLog = (message) => {
	const log = $("#operationLog");
	const timestamp = new Date().toLocaleTimeString();
	const logEntry = document.createElement("div");
	logEntry.textContent = `[${timestamp}] ${message}`;
	log.appendChild(logEntry);
	log.scrollTop = log.scrollHeight;
};

const getGridLayout = () => {
	const selectedLayout = document.querySelector('input[name="gridLayout"]:checked').value;
	switch (selectedLayout) {
		case "2x1":
			return { rows: 1, cols: 2 };
		case "2x2":
			return { rows: 2, cols: 2 };
		default:
			return { rows: 1, cols: 1 };
	}
};

const createPreviewCanvas = () => {
	const canvas = document.createElement("canvas");
	const grid = getGridLayout();
	canvas.width = labelSize.height * 8 * grid.cols;
	canvas.height = labelSize.width * 8 * grid.rows;
	return canvas;
};

const updatePreviewContainer = () => {
	const container = $("#previewContainer");
	const copies = $("#inputCopies").valueAsNumber;

	// Clear existing previews except the first one
	while (container.children.length > 1) {
		container.removeChild(container.lastChild);
	}

	// Add new previews
	for (let i = 1; i < copies; i++) {
		const card = document.createElement("div");
		card.className = "card shadow-sm";
		const cardBody = document.createElement("div");
		cardBody.className = "card-body p-1";
		const canvas = createPreviewCanvas();
		cardBody.appendChild(canvas);
		card.appendChild(cardBody);
		container.appendChild(card);
	}

	// Update all canvases
	updateAllPreviews();
};

const updateAllPreviews = () => {
	const canvases = $all("#previewContainer canvas");
	for (const canvas of canvases) {
		if ($("#nav-text-tab").classList.contains("active")) {
			updateCanvasText(canvas);
		} else {
			updateCanvasBarcode(canvas);
		}
	}
};

const updateLabelSize = (canvas) => {
	const inputWidth = $("#inputWidth").valueAsNumber;
	const inputHeight = $("#inputHeight").valueAsNumber;
	if (Number.isNaN(inputWidth) || Number.isNaN(inputHeight)) {
		handleError("label size invalid");
		return;
	}

	labelSize.width = inputWidth;
	labelSize.height = inputHeight;

	const grid = getGridLayout();
	// Image sent to printer is printed top to bottom, so reverse width and height
	canvas.width = labelSize.height * 8 * grid.cols;
	canvas.height = labelSize.width * 8 * grid.rows;
};

const updateCanvasText = (canvas) => {
	const text = $("#inputText").value;
	const fontSize = $("#inputFontSize").valueAsNumber;
	if (Number.isNaN(fontSize)) {
		handleError("font size invalid");
		return;
	}

	const ctx = canvas.getContext("2d");
	const grid = getGridLayout();

	// Clear the entire canvas
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Draw text across the entire grid as one continuous canvas
	ctx.save();
	ctx.translate(canvas.width / 2, canvas.height / 2);
	ctx.rotate(Math.PI / 2);

	ctx.fillStyle = "#000";
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	drawText(ctx, text, {
		x: -canvas.height / 2,
		y: -canvas.width / 2,
		width: canvas.height,
		height: canvas.width,
		font: "sans-serif",
		fontSize,
	});

	ctx.restore();
};

const updateCanvasBarcode = (canvas) => {
	const barcodeData = $("#inputBarcode").value;
	const grid = getGridLayout();

	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const image = document.createElement("img");
	image.addEventListener("load", () => {
		// Draw barcode across the entire grid as one continuous canvas
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(Math.PI / 2);

		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(image, -image.width / 2, -image.height / 2);

		ctx.restore();
	});

	JsBarcode(image, barcodeData, {
		format: "CODE128",
		width: 2,
		height: labelSize.height * 7 * Math.max(grid.rows, grid.cols), // Scale barcode height based on grid size
		displayValue: false,
	});
};

const drawImageToCanvas = (ctx, url, doScale = true) => {
	const img = new Image();
	img.addEventListener("load", () => {
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(Math.PI / 2);

		ctx.imageSmoothingEnabled = false;
		// draw image in center of canvas, scaled to fit
		const scale = doScale ? Math.min(canvas.height / img.width, canvas.width / img.height) : 1;
		const drawWidth = img.width * scale;
		const drawHeight = img.height * scale;
		ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

		ctx.rotate(-Math.PI / 2);
		ctx.translate(-canvas.width / 2, -canvas.height / 2);
	});
	img.addEventListener("error", () => {
		handleError("failed to load image");
	});

	img.src = url;
};

const updateCanvasImage = (canvas) => {
	const ctx = canvas.getContext("2d");
	const file = $("#inputImage").files[0];
	if (!file) {
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return;
	}

	const reader = new FileReader();
	reader.addEventListener("load", (e) => {
		drawImageToCanvas(ctx, e.target.result);
	});
	reader.addEventListener("error", () => {
		handleError("failed to read image file");
	});

	reader.readAsDataURL(file);
};

const updateCanvasQR = async (canvas) => {
	const data = $("#inputQR").value;
	const ctx = canvas.getContext("2d");
	const qrImg = await QRCode.toDataURL(data, { width: canvas.width - 8, margin: 2 });
	drawImageToCanvas(ctx, qrImg, false);
};

const updateCanvasQRText = async (canvas) => {
	const data = $("#inputQRTextData").value;
	const text = $("#inputQRText").value;
	const fontSizeInput = $("#inputQRTextSize").valueAsNumber;
	const ctx = canvas.getContext("2d");
	const labelWidth = canvas.height;
	const labelHeight = canvas.width;
	const padding = 4;
	const gap = 6;
	const left = -labelWidth / 2 + padding;
	const top = -labelHeight / 2 + padding;
	const right = labelWidth / 2 - padding;
	const bottom = labelHeight / 2 - padding;
	const fallbackFontSize = Math.floor(labelHeight * 0.4);
	const fontSize = isNaN(fontSizeInput)
		? Math.max(10, Math.min(48, fallbackFontSize))
		: Math.max(1, fontSizeInput);

	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const maxQrSize = Math.max(16, Math.min(labelHeight - padding * 2, labelWidth - padding * 2));
	let qrSize = maxQrSize;
	if (text.trim()) {
		const minTextWidth = 32;
		const availableForQr = right - left - gap - minTextWidth;
		qrSize = Math.max(16, Math.min(maxQrSize, availableForQr));
	}
	const qrImg = await QRCode.toDataURL(data, { width: qrSize, margin: 1 });
	const image = new Image();
	image.addEventListener("load", () => {
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(Math.PI / 2);

		ctx.imageSmoothingEnabled = false;
		if (!text.trim()) {
			const drawX = -labelWidth / 2 + (labelWidth - qrSize) / 2;
			const drawY = -labelHeight / 2 + (labelHeight - qrSize) / 2;
			ctx.drawImage(image, drawX, drawY, qrSize, qrSize);
		} else {
			const qrX = left;
			const qrY = top;
			ctx.drawImage(image, qrX, qrY, qrSize, qrSize);

			ctx.fillStyle = "#000";
			ctx.textAlign = "left";
			ctx.textBaseline = "top";
			const textX = qrX + qrSize + gap;
			const textY = top;
			const textWidth = Math.max(0, right - textX);
			const textHeight = Math.max(0, bottom - top);
			if (textWidth > 0 && textHeight > 0) {
				drawText(ctx, text, {
					x: textX,
					y: textY,
					width: textWidth,
					height: textHeight,
					font: "sans-serif",
					fontSize,
				});
			}
		}

		ctx.rotate(-Math.PI / 2);
		ctx.translate(-canvas.width / 2, -canvas.height / 2);
	});
	image.addEventListener("error", () => {
		handleError("failed to load QR code");
	});
	image.src = qrImg;
};

const handleError = (err) => {
	console.error(err);

	const toast = bootstrap.Toast.getOrCreateInstance($("#errorToast"));
	$("#errorText").textContent = err.toString();
	toast.show();
};

const updateConnectionStatus = (connected, deviceName = '') => {
	const status = $("#connectionStatus");
	const connectBtn = $("#connectToggleBtn");
	status.style.display = 'block';
	if (connected) {
		status.className = 'alert alert-success mb-3';
		$("#connectionState").textContent = `Connected to ${deviceName}`;
		connectBtn.textContent = 'Disconnect';
		connectBtn.className = 'btn btn-secondary';
		$("#printBtn").disabled = false;
		addLog(`Connected to printer: ${deviceName}`);
	} else {
		status.className = 'alert alert-info mb-3';
		$("#connectionState").textContent = 'Not connected';
		connectBtn.textContent = 'Connect';
		connectBtn.className = 'btn btn-primary';
		$("#printBtn").disabled = true;
		printerCharacteristic = null;
		addLog('Disconnected from printer');
	}
};

const togglePrinterConnection = async () => {
	if (printerCharacteristic) {
		// If connected, disconnect
		try {
			addLog('Disconnecting from printer...');
			await printerCharacteristic.service.device.gatt.disconnect();
			updateConnectionStatus(false);
		} catch (error) {
			handleError(error);
		}
	} else {
		// If disconnected, connect
		try {
			addLog('Requesting Bluetooth device...');
			const device = await navigator.bluetooth.requestDevice({
				acceptAllDevices: true,
				optionalServices: ["0000ff00-0000-1000-8000-00805f9b34fb"],
			});

			addLog('Connecting to GATT server...');
			const server = await device.gatt.connect();

			addLog('Getting primary service...');
			const service = await server.getPrimaryService("0000ff00-0000-1000-8000-00805f9b34fb");

			addLog('Getting characteristic...');
			printerCharacteristic = await service.getCharacteristic("0000ff02-0000-1000-8000-00805f9b34fb");

			updateConnectionStatus(true, device.name);

			// Listen for disconnection
			device.addEventListener('gattserverdisconnected', () => {
				addLog('Printer disconnected unexpectedly');
				updateConnectionStatus(false);
			});
		} catch (error) {
			handleError(error);
		}
	}
};

const printLabels = async () => {
	if (!printerCharacteristic) {
		handleError("Not connected to printer");
		return;
	}

	const copies = $("#inputCopies").valueAsNumber;
	if (Number.isNaN(copies) || copies < 1) {
		handleError("Number of copies must be at least 1");
		return;
	}

	try {
		addLog(`Starting print job: ${copies} copy/copies`);
		const grid = getGridLayout();
		const cellWidth = canvas.width / grid.cols;
		const cellHeight = canvas.height / grid.rows;

		// Create a temporary canvas for each sticker
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = labelSize.height * 8;  // Single sticker width
		tempCanvas.height = labelSize.width * 8;  // Single sticker height
		const tempCtx = tempCanvas.getContext("2d");

		for (let copy = 0; copy < copies; copy++) {
			addLog(`Printing copy ${copy + 1} of ${copies}`);
			// For each copy, print all stickers in the grid
			for (let row = 0; row < grid.rows; row++) {
				for (let col = 0; col < grid.cols; col++) {
					// Clear the temporary canvas
					tempCtx.fillStyle = "#fff";
					tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

					// Copy the corresponding section from the main canvas
					tempCtx.drawImage(
						canvas,
						col * cellWidth,
						row * cellHeight,
						cellWidth,
						cellHeight,
						0,
						0,
						tempCanvas.width,
						tempCanvas.height
					);

					// Print the sticker
					addLog(`Printing sticker ${row * grid.cols + col + 1} of ${grid.rows * grid.cols}`);
					await printCanvas(printerCharacteristic, tempCanvas);

					// Add a small delay between stickers
					if (col < grid.cols - 1 || row < grid.rows - 1) {
						await new Promise((resolve) => setTimeout(resolve, 500));
					}
				}
			}

			// Add a longer delay between copies
			if (copy < copies - 1) {
				addLog('Waiting between copies...');
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
		addLog('Print job completed successfully');
	} catch (error) {
		handleError(error);
	}
};

document.addEventListener("DOMContentLoaded", () => {
	const canvas = document.querySelector("#canvas");

	document.addEventListener("shown.bs.tab", (e) => {
		if (e.target.id === "nav-text-tab") updateAllPreviews();
		else if (e.target.id === "nav-barcode-tab") updateAllPreviews();
		else if (e.target.id === "nav-image-tab") updateCanvasImage(canvas);
		else if (e.target.id === "nav-qr-tab") updateCanvasQR(canvas);
		else if (e.target.id === "nav-qr-text-tab") updateCanvasQRText(canvas);
	});

	for (const e of $all("#inputWidth, #inputHeight")) {
		e.addEventListener("input", () => {
			updateLabelSize(canvas);
			updateAllPreviews();
		});
	}
	updateLabelSize(canvas);

	for (const e of $all("#inputText, #inputFontSize")) {
		e.addEventListener("input", () => updateAllPreviews());
	}
	updateCanvasText(canvas);

	$("#inputBarcode").addEventListener("input", () => updateAllPreviews());

	$("#inputCopies").addEventListener("input", () => updatePreviewContainer());
	$("#inputImage").addEventListener("change", () => updateCanvasImage(canvas));
	$("#inputQR").addEventListener("input", () => updateCanvasQR(canvas));
	$all("#inputQRTextData, #inputQRText, #inputQRTextSize").forEach((e) =>
		e.addEventListener("input", () => updateCanvasQRText(canvas))
	);

	// Add event listener for grid layout changes
	for (const e of $all('input[name="gridLayout"]')) {
		e.addEventListener("change", () => {
			updateLabelSize(canvas);
			updateAllPreviews();
		});
	}

	// Add event listeners for the buttons
	$("#connectToggleBtn").addEventListener("click", togglePrinterConnection);
	$("#printBtn").addEventListener("click", printLabels);

	// Initialize connection status
	updateConnectionStatus(false);
});
