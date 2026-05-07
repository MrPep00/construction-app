# Naprawa flow zaproszeniowego — Supabase redirect URL

## Problem
Wpisanie emaila na stronie `/invite/[token]` zwraca błąd z Supabase przy wysyłaniu magic linka.
Najczęstsza przyczyna: Supabase odrzuca `emailRedirectTo` zawierające parametr `?next=...`,
bo pełny URL nie jest na liście dozwolonych redirect URL-i.

---

## Krok 1 — Dodaj wildcard do listy redirect URL w Supabase

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

Dodaj oba wpisy (kliknij „Add URL"):

```
https://<twoja-domena>.vercel.app/auth/callback*
http://localhost:3000/auth/callback*
```

Gwiazdka `*` na końcu pozwala na dowolny suffix — w tym `?next=/invite/abc123`.

---

## Krok 2 — Sprawdź logi Auth (jeśli krok 1 nie pomógł)

**Supabase Dashboard → Authentication → Logs**

Poszukaj nieudanych prób OTP/magic link — zobaczysz dokładny komunikat błędu z Supabase.

---

## Krok 3 — Sprawdź ograniczenia domeny email (jeśli logi pokazują inny błąd)

**Supabase Dashboard → Authentication → Settings**

Upewnij się, że nie ma skonfigurowanej listy dozwolonych domen email
(pole „Allowed email domains" powinno być puste).

---

## Krok 4 — Sprawdź rate limiting

Supabase free tier ma limit ok. 3–4 maili OTP na godzinę globalnie.
Jeśli dużo testowałeś, poczekaj godzinę i spróbuj ponownie.

---

## Weryfikacja po naprawie

1. Wejdź na `/invite/[token]` w trybie incognito (wylogowany)
2. Wpisz nowy email → kliknij „Wyślij link logowania"
3. Toast NIE powinien pokazać błędu — zamiast tego pojawi się:
   „Sprawdź email — link logowania wysłany."
4. Kliknij link w emailu → wrócisz na `/invite/[token]` już zalogowany
5. Kliknij „Dołącz do zespołu" → przekierowanie na `/projects`
