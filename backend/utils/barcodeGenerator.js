//Utilidad para generar códigos de barras
exports.generateBarcode = async () => {
    // Generar un código EAN-13
    const prefix = '200'; // Prefijo para productos internos
    const middleDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const barcodeWithoutChecksum = prefix + middleDigits;

    // Calcular dígito de verificación
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(barcodeWithoutChecksum[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return barcodeWithoutChecksum + checkDigit;
};