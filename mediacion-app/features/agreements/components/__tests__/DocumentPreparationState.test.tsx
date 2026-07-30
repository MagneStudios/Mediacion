import { render, screen } from '@testing-library/react-native';

import { DocumentPreparationState } from '../DocumentPreparationState';

describe('DocumentPreparationState', () => {
  const baseProps = {
    title: 'Preparing the document',
    description: 'The file will be ready in a moment.',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the title and description', async () => {
      await render(<DocumentPreparationState {...baseProps} />);
      expect(screen.getByText('Preparing the document')).toBeTruthy();
      expect(screen.getByText('The file will be ready in a moment.')).toBeTruthy();
    });

    it('renders a progress indicator', async () => {
      const view = await render(<DocumentPreparationState {...baseProps} />);
      const progressbars = view.container.queryAll(
        (instance) => instance.props.accessibilityRole === 'progressbar',
      );
      expect(progressbars.length).toBe(1);
    });
  });

  describe('accessibility — progress / busy semantics', () => {
    it('exposes the container as a polite live region', async () => {
      const view = await render(<DocumentPreparationState {...baseProps} />);
      const liveRegionNodes = view.container.queryAll(
        (instance) => instance.props.accessibilityLiveRegion === 'polite',
      );
      expect(liveRegionNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('announces the progressbar with the title as its accessible label', async () => {
      const view = await render(<DocumentPreparationState {...baseProps} />);
      const progressbars = view.container.queryAll(
        (instance) => instance.props.accessibilityRole === 'progressbar',
      );
      expect(progressbars[0].props.accessibilityLabel).toBe('Preparing the document');
    });

    it('keeps title and description as separate accessible text nodes', async () => {
      await render(<DocumentPreparationState {...baseProps} />);
      expect(screen.getByText('Preparing the document')).toBeTruthy();
      expect(screen.getByText('The file will be ready in a moment.')).toBeTruthy();
    });
  });

  describe('accessibility — label updates with different props', () => {
    it('uses the title prop as the progressbar label', async () => {
      const view = await render(
        <DocumentPreparationState title="Exporting agreement" description="Please wait." />,
      );
      const progressbars = view.container.queryAll(
        (instance) => instance.props.accessibilityRole === 'progressbar',
      );
      expect(progressbars[0].props.accessibilityLabel).toBe('Exporting agreement');
    });
  });
});
