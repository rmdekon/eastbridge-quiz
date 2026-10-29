import React from 'react';
import { Link } from 'react-router-dom';
import { Btn, Logo } from '../components/ui';

export const NotFound: React.FC = () => (
  <div className="page-tight py-16 text-center">
    <div className="flex justify-center">
      <Logo size={72} />
    </div>
    <h1 className="font-display text-3xl font-bold text-navy-700 mt-4">This page flew away</h1>
    <p className="text-navy-300 mt-2 max-w-md mx-auto">
      The link may be old, or the quiz may have been deleted. Try the library or join a live game.
    </p>
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <Link to="/">
        <Btn variant="gold">Back to the arcade</Btn>
      </Link>
      <Link to="/join">
        <Btn variant="ghost">Join a game</Btn>
      </Link>
    </div>
  </div>
);
