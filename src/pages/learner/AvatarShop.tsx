import React, { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Btn, Card, Tabs } from '../../components/ui';
import { AVATARS, BADGES, SHOP_ITEMS } from '../../data/avatars';
import { useApp } from '../../store/AppStore';
import { cx } from '../../lib/utils';
import { sfx } from '../../lib/sfx';

export const AvatarShop: React.FC = () => {
  const { user, saveProfile, notify } = useApp();
  const [tab, setTab] = useState<'skin' | 'hat' | 'trail'>('skin');
  const [busy, setBusy] = useState<string | null>(null);

  if (!user) return null;

  const owned = new Set(['eagle-gold', 'eagle-navy', 'eagle-teal', 'eagle-sage', ...user.ownedItems]);
  const items = AVATARS.filter((a) => a.kind === tab || (tab === 'skin' && a.kind === 'base'));

  const equipped = (id: string) => user.avatarId === id || user.hatId === id || user.trailId === id;

  const buy = async (id: string, price: number) => {
    if (user.coins < price) {
      notify(`You need ${price - user.coins} more Eagle Coins`, 'error');
      return;
    }
    setBusy(id);
    await saveProfile({
      ...user,
      coins: user.coins - price,
      ownedItems: [...new Set([...user.ownedItems, id])],
    });
    sfx.coin();
    notify('Purchased! Equip it from the shop.', 'success');
    setBusy(null);
  };

  const equip = async (item: (typeof AVATARS)[number]) => {
    setBusy(item.id);
    if (item.kind === 'hat') await saveProfile({ ...user, hatId: user.hatId === item.id ? undefined : item.id });
    else if (item.kind === 'trail') await saveProfile({ ...user, trailId: user.trailId === item.id ? undefined : item.id });
    else await saveProfile({ ...user, avatarId: item.id });
    setBusy(null);
  };

  return (
    <div className="page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Avatar shop</h1>
          <p className="text-sm text-navy-300 mt-1">Spend Eagle Coins on skins, hats and trails. Nothing here affects grades.</p>
        </div>
        <div className="rounded-2xl bg-gold-100 px-4 py-2 text-center">
          <p className="text-[10px] font-bold uppercase text-gold-600">Your coins</p>
          <p className="font-display text-2xl font-bold text-gold-600">🪙 {user.coins.toLocaleString()}</p>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar id={user.avatarId} size={84} hat={user.hatId} trail={user.trailId} ring />
          <div>
            <p className="font-display text-xl font-bold text-navy-700">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-navy-300">Level {Math.floor(Math.sqrt(user.xp / 45)) + 1} · {user.badges.length} badges</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user.badges.slice(0, 4).map((b) => (
                <span key={b} className="badge-gold">
                  {BADGES[b]?.emoji ?? '🏅'} {b}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-navy-50 px-3 py-2">
              <p className="font-display text-lg font-bold text-navy-700">{owned.size}</p>
              <p className="text-[10px] uppercase text-navy-300">Items</p>
            </div>
            <div className="rounded-xl bg-navy-50 px-3 py-2">
              <p className="font-display text-lg font-bold text-navy-700">{SHOP_ITEMS.length - (owned.size - 4)}</p>
              <p className="text-[10px] uppercase text-navy-300">To unlock</p>
            </div>
            <div className="rounded-xl bg-navy-50 px-3 py-2">
              <p className="font-display text-lg font-bold text-navy-700">🪙</p>
              <p className="text-[10px] uppercase text-navy-300">Earn in games</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'skin', label: '🎨 Skins' },
            { id: 'hat', label: '🎩 Hats' },
            { id: 'trail', label: '✨ Trails' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          const isEquipped = equipped(item.id);
          return (
            <Card key={item.id} className={cx('text-center', isEquipped && 'ring-2 ring-gold-500')}>
              <div className="flex justify-center">
                <Avatar
                  id={tab === 'hat' ? user.avatarId : item.id}
                  size={72}
                  hat={tab === 'hat' ? item.id : user.hatId}
                  trail={tab === 'trail' ? item.id : user.trailId}
                />
              </div>
              <p className="mt-2 font-display font-bold text-navy-700">{item.name}</p>
              <p className="text-xs text-navy-300 capitalize">{item.kind}</p>
              {isEquipped ? (
                <p className="mt-2 text-sm font-bold text-sage-500">✓ Equipped</p>
              ) : isOwned ? (
                <Btn size="sm" variant="ghost" className="mt-2 w-full" loading={busy === item.id} onClick={() => equip(item)}>
                  Equip
                </Btn>
              ) : (
                <Btn
                  size="sm"
                  variant="gold"
                  className="mt-2 w-full"
                  loading={busy === item.id}
                  onClick={() => buy(item.id, item.price)}
                  disabled={user.coins < item.price}
                >
                  🪙 {item.price}
                </Btn>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 bg-navy-50 border-navy-100">
        <h3 className="font-display font-bold text-navy-700">How to earn coins</h3>
        <ul className="mt-2 space-y-1 text-sm text-navy-500">
          <li>🎯 +10 coins for every correct answer in a task</li>
          <li>🎮 Every coin you bank in an arcade break is yours</li>
          <li>🔥 Finishing with 100% accuracy gives a bonus 40 coins</li>
          <li>🏆 Live games award coins based on mode (Eagle Cash pays the most)</li>
        </ul>
      </Card>
    </div>
  );
};
