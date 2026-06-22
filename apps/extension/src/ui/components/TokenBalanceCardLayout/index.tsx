import { CSSProperties, ReactNode } from 'react';

import { Column } from '../Column';
import { Row } from '../Row';
import { TokenBalancePrice } from '../TokenBalancePrice';

export const TOKEN_BALANCE_CARD_HEIGHT = 68;
const ICON_COLUMN_WIDTH = 35;
const CONTENT_GAP = 8;

export const tokenBalanceCardStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 12,
  boxSizing: 'border-box',
  paddingTop: 10,
  paddingBottom: 10,
  paddingLeft: 12,
  paddingRight: 12,
  alignItems: 'stretch',
  width: '100%',
  overflow: 'hidden',
  flexDirection: 'column'
};

export function getTokenBalanceCardStyle(adaptive = false): CSSProperties {
  return {
    ...tokenBalanceCardStyle,
    minHeight: TOKEN_BALANCE_CARD_HEIGHT,
    height: adaptive ? 'auto' : TOKEN_BALANCE_CARD_HEIGHT
  };
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${ICON_COLUMN_WIDTH}px minmax(0, 1fr)`,
  gap: CONTENT_GAP,
  width: '100%',
  overflow: 'hidden',
  alignItems: 'center'
};

const titleRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: CONTENT_GAP,
  width: '100%',
  alignItems: 'start'
};

const titleCellStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  gap: CONTENT_GAP,
  flexWrap: 'nowrap',
  justifyContent: 'flex-start'
};

const titleNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  flex: '0 1 auto'
};

const titleExtraStyle: CSSProperties = {
  flexShrink: 0
};

const quantityCellStyle: CSSProperties = {
  flexShrink: 0,
  whiteSpace: 'nowrap',
  justifySelf: 'end'
};

export type TokenBalanceCardLayoutProps = {
  icon: ReactNode;
  title: ReactNode;
  quantity: ReactNode;
  balance: string;
  showPrice?: boolean;
  price?: any;
  titleExtra?: ReactNode;
  onIconClick?: () => void;
};

export function TokenBalanceCardLayout({
  icon,
  title,
  quantity,
  balance,
  showPrice,
  price,
  titleExtra,
  onIconClick
}: TokenBalanceCardLayoutProps) {
  return (
    <div style={cardGridStyle}>
      <div onClick={onIconClick} style={{ flexShrink: 0 }}>
        {icon}
      </div>
      <Column gap="xs" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={titleRowStyle}>
          <div style={titleCellStyle}>
            <div style={titleNameStyle}>{title}</div>
            {titleExtra ? <div style={titleExtraStyle}>{titleExtra}</div> : null}
          </div>
          <div style={quantityCellStyle}>{quantity}</div>
        </div>
        <TokenBalancePrice showPrice={showPrice} price={price} balance={balance} />
      </Column>
    </div>
  );
}
