import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideTransloco({ config: { availableLangs: ['fr', 'en'], defaultLang: 'fr' } }),
      ],
    }).compileComponents();
  });

  it('shows the brand and both language switches', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain('Can I Run It?');
    expect(
      [...element.querySelectorAll('.languages button')].map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['FR', 'EN']);
  });
});
