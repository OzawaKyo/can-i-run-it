import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LANGUAGES, rememberLanguage, type Language } from './i18n/language';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslocoPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly transloco = inject(TranslocoService);
  protected readonly languages = LANGUAGES;
  protected readonly language = this.transloco.activeLang;

  constructor() {
    this.transloco.langChanges$.subscribe((language) => (document.documentElement.lang = language));
  }

  protected setLanguage(language: Language): void {
    this.transloco.setActiveLang(language);
    rememberLanguage(language);
  }
}
