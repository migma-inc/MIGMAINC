import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { cleanDocumentNumber, mapPaymentMethod } from "./utils.ts";

Deno.test("cleanDocumentNumber - should remove non-numeric characters", () => {
    assertEquals(cleanDocumentNumber("123.456.789-01"), "12345678901");
    assertEquals(cleanDocumentNumber("12.345.678/0001-99"), "12345678000199");
});

Deno.test("cleanDocumentNumber - should return null for empty input", () => {
    assertEquals(cleanDocumentNumber(null), null);
    assertEquals(cleanDocumentNumber(""), null);
});

Deno.test("mapPaymentMethod - should map strings to Parcelow codes", () => {
    assertEquals(mapPaymentMethod("card"), 1);
    assertEquals(mapPaymentMethod("parcelow_card"), 1);
    assertEquals(mapPaymentMethod("pix"), 2);
    assertEquals(mapPaymentMethod("ted"), 4);
});

Deno.test("mapPaymentMethod - should handle numeric strings", () => {
    assertEquals(mapPaymentMethod("1"), 1);
    assertEquals(mapPaymentMethod("2"), 2);
    assertEquals(mapPaymentMethod("4"), 4);
});

Deno.test("mapPaymentMethod - should return undefined for invalid methods", () => {
    assertEquals(mapPaymentMethod("crypto"), undefined);
    assertEquals(mapPaymentMethod(undefined), undefined);
});
