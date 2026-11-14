declare namespace App {
  interface Locals {
    /**
     * Set by EntryPage while it renders a profile, so the headings of the body and the map summary
     * can show which territory and skills each section covers without repeating the front matter.
     */
    coverage?: import('./editorial/coverage.ts').EntryCoverage;
  }
}
