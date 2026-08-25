/**
 * helpers/cpf.ts
 * Validação e limpeza do CPF brasileiro pelo algoritmo dos dígitos verificadores.
 */

/** Remove tudo que não for dígito do CPF. */
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida o CPF pelos dígitos verificadores oficiais.
 * Rejeita sequências repetidas (111.111.111-11, etc.) e comprimentos errados.
 */
export function validateCPF(cpf: string): boolean {
  const c = cleanCPF(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos os dígitos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10]);
}
