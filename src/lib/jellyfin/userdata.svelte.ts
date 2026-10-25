/**
 * Zähler für Änderungen an Benutzerdaten (gesehen, Favorit, Wiedergabefortschritt).
 * Zwischengespeicherte Listen (z. B. Bibliotheken) vergleichen ihn, um nach einer
 * Änderung nicht veraltete Filterergebnisse anzuzeigen.
 */
class UserDataVersion {
  value = $state(0);

  bump(): void {
    this.value++;
  }
}

export const userDataVersion = new UserDataVersion();
