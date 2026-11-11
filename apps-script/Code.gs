const SHEET_NAME = "Transactions";
const HEADERS = ["id", "date", "category", "description", "amount", "type"];

function doGet() {
  try {
    const sheet = getTransactionsSheet_();
    const values = sheet.getDataRange().getValues();
    const transactions = values.slice(1)
      .filter(function (row) { return row[0] !== ""; })
      .map(function (row) {
        return {
          id: String(row[0]),
          date: normalizeDate_(row[1]),
          category: String(row[2]),
          description: String(row[3]),
          amount: Number(row[4]),
          type: String(row[5])
        };
      });
    return jsonResponse_({ success: true, data: transactions });
  } catch (error) {
    return jsonResponse_({ success: false, error: error.message });
  }
}

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const transaction = validateTransaction_(request.transaction);
    const sheet = getTransactionsSheet_();
    const rows = sheet.getDataRange().getValues();

    if (request.action === "create") {
      if (rows.slice(1).some(function (row) { return String(row[0]) === transaction.id; })) {
        throw new Error("ID transaksi sudah digunakan.");
      }
      sheet.appendRow(toRow_(transaction));
    } else if (request.action === "update") {
      const rowIndex = rows.findIndex(function (row, index) {
        return index > 0 && String(row[0]) === transaction.id;
      });
      if (rowIndex < 1) throw new Error("Transaksi yang akan diperbarui tidak ditemukan.");
      sheet.getRange(rowIndex + 1, 1, 1, HEADERS.length).setValues([toRow_(transaction)]);
    } else {
      throw new Error("Action harus berupa create atau update.");
    }
    return jsonResponse_({ success: true, data: transaction });
  } catch (error) {
    return jsonResponse_({ success: false, error: error.message });
  }
}

function getTransactionsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Script harus terhubung ke Google Sheets.");
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function validateTransaction_(value) {
  if (!value || typeof value !== "object") throw new Error("Data transaksi wajib diisi.");
  const transaction = {
    id: String(value.id || "").trim(),
    date: String(value.date || "").trim(),
    category: String(value.category || "").trim(),
    description: String(value.description || "").trim(),
    amount: Number(value.amount),
    type: String(value.type || "").trim()
  };
  if (!transaction.id || transaction.id.length > 100) throw new Error("ID transaksi tidak valid.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) throw new Error("Tanggal harus berformat YYYY-MM-DD.");
  if (!transaction.category || transaction.category.length > 60) throw new Error("Kategori wajib diisi (maksimal 60 karakter).");
  if (!transaction.description || transaction.description.length > 120) throw new Error("Keterangan wajib diisi (maksimal 120 karakter).");
  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) throw new Error("Nominal harus berupa angka lebih dari nol.");
  if (transaction.type !== "income" && transaction.type !== "expense") throw new Error("Jenis transaksi tidak valid.");
  return transaction;
}

function toRow_(transaction) {
  return [transaction.id, transaction.date, transaction.category, transaction.description, transaction.amount, transaction.type];
}

function normalizeDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
