import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Avatar from './Avatar';

describe('Avatar Component', () => {
  it('renders with an image if url is provided', () => {
    render(<Avatar name="John Doe" url="https://example.com/avatar.jpg" />);
    const imgElement = screen.getByAltText('John Doe');
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders initials if url is not provided', () => {
    render(<Avatar name="John Doe" />);
    const textElement = screen.getByText('JD');
    expect(textElement).toBeInTheDocument();
  });

  it('renders a single initial for single-word names', () => {
    render(<Avatar name="Alice" />);
    const textElement = screen.getByText('A');
    expect(textElement).toBeInTheDocument();
  });
});
