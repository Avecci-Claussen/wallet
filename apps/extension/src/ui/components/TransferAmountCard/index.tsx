import { CSSProperties, ReactNode } from 'react';

import { useI18n } from '@unisat/wallet-state';
import { BigNumber } from 'bignumber.js';

import { fontSizes } from '@/ui/theme/font';

import { Column } from '../Column';
import { Icon } from '../Icon';
import { Row } from '../Row';
import { Text } from '../Text';
import { Tooltip } from '../Tooltip';

const amountCardStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  padding: '0 16px 12px',
  boxSizing: 'border-box'
};

export const sendInputContainerStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  boxSizing: 'border-box'
};

const amountInputSectionStyle: CSSProperties = {
  height: 76,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%'
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 54,
  background: 'transparent',
  border: 'none',
  color: '#fff',
  padding: 0,
  outline: 'none',
  fontSize: 20
};

const maxButtonStyle: CSSProperties = {
  height: 28,
  minWidth: 56,
  borderRadius: 8,
  border: '1px solid rgba(244, 182, 44, 0.45)',
  color: 'rgba(244, 182, 44, 0.85)',
  background: 'transparent',
  fontSize: 14,
  cursor: 'pointer',
  justifyContent: 'center',
  textAlign: 'center'
};

const unlockButtonStyle: CSSProperties = {
  height: 24,
  minWidth: 56,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid rgba(244, 182, 44, 0.45)',
  color: 'rgba(244, 182, 44, 0.85)',
  background: 'transparent',
  fontSize: 12,
  cursor: 'pointer'
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.12)',
  width: '100%'
};

const fieldHeaderStyle: CSSProperties = {
  minHeight: 26,
  alignItems: 'center'
};

function isValidAmountInput(
  value: string,
  options: { disableDecimal?: boolean; runesDecimal?: number }
) {
  if (value === '') return true;

  if (options.disableDecimal) {
    return /^[1-9]\d*$/.test(value);
  }

  if (options.runesDecimal !== undefined) {
    const regex = new RegExp(`^(0(\\.\\d{0,${options.runesDecimal}})?|[1-9]\\d*\\.?\\d{0,${options.runesDecimal}})$`);
    return regex.test(value);
  }

  return /^(0(\.\d{0,8})?|[1-9]\d*\.?\d{0,8})$/.test(value);
}

function isWithinAvailableAmount(value: string, availableAmount: string) {
  if (value === '') return true;

  const inputAmount = new BigNumber(value.replace(/,/g, ''));
  const maxAmount = new BigNumber(availableAmount.replace(/,/g, ''));

  if (!inputAmount.isFinite() || !maxAmount.isFinite()) {
    return true;
  }

  return inputAmount.lte(maxAmount);
}

export type TransferAmountCardProps = {
  amount: string;
  onAmountChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  showMax?: boolean;
  onMaxClick?: () => void;
  availableAmount: string;
  unit: string;
  amountMuted?: boolean;
  runesDecimal?: number;
  disableDecimal?: boolean;
  inputTestId?: string;
  footer?: ReactNode;
  availableExtra?: ReactNode;
};

export type TransferAmountUnavailableRowProps = {
  amount: string;
  unit: string;
  tipText: string;
  showUnlock?: boolean;
  onUnlock?: () => void;
};

export function TransferAmountUnavailableRow({
  amount,
  unit,
  tipText,
  showUnlock = false,
  onUnlock
}: TransferAmountUnavailableRowProps) {
  const { t } = useI18n();

  return (
    <Row justifyBetween fullX itemsCenter style={{ marginTop: 12 }}>
      <Row itemsCenter gap="md">
        <Tooltip
          title={tipText}
          placement="top"
          autoAdjustOverflow={true}
          align={{
            overflow: {
              adjustX: true,
              adjustY: true
            }
          }}
          overlayStyle={{
            fontSize: fontSizes.xs,
            maxWidth: '280px',
            wordWrap: 'break-word',
            whiteSpace: 'normal'
          }}>
          <Row itemsCenter gap="xs">
            <Text text={t('unavailable')} color="ticker_color2" size="xs" />
            <Icon icon="circle-question" color="textDim" size={12} />
          </Row>
        </Tooltip>
        {showUnlock ? (
          <button type="button" style={unlockButtonStyle} onClick={onUnlock}>
            {t('unlock')}
          </button>
        ) : null}
      </Row>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Text text={amount} color="ticker_color2" size="xs" wrap />
        <Text text={` ${unit}`} size="xs" style={{ color: 'rgba(255, 255, 255, 0.45)' }} disableTranslate wrap />
      </Row>
    </Row>
  );
}

export function TransferAmountSection(props: {
  title?: string;
  titleExtra?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <Column gap="sm">
      <Row justifyBetween style={fieldHeaderStyle}>
        <Text text={props.title || t('transfer_amount')} />
        {props.titleExtra}
      </Row>
      {props.children}
    </Column>
  );
}

export function TransferAmountCard({
  amount,
  onAmountChange,
  placeholder = '0',
  readOnly = false,
  showMax = false,
  onMaxClick,
  availableAmount,
  unit,
  amountMuted = false,
  runesDecimal,
  disableDecimal,
  inputTestId,
  footer,
  availableExtra
}: TransferAmountCardProps) {
  const { t } = useI18n();
  const inputColor = readOnly || amountMuted ? 'rgba(255, 255, 255, 0.45)' : '#fff';

  return (
    <Column gap="zero" style={amountCardStyle}>
      <div style={amountInputSectionStyle}>
        <input
          value={amount}
          onChange={(e) => {
            if (readOnly) return;
            const value = e.target.value;
            if (
              isValidAmountInput(value, { disableDecimal, runesDecimal }) &&
              isWithinAvailableAmount(value, availableAmount)
            ) {
              onAmountChange(value);
            }
          }}
          placeholder={placeholder}
          inputMode={runesDecimal !== undefined && runesDecimal > 0 ? 'decimal' : 'numeric'}
          readOnly={readOnly}
          style={{ ...inputStyle, flex: 1, color: inputColor }}
          data-testid={inputTestId}
        />
        {showMax ? (
          <button type="button" style={maxButtonStyle} onClick={onMaxClick}>
            {t('max')}
          </button>
        ) : null}
      </div>
      <div style={dividerStyle} />
      <Row justifyBetween itemsCenter style={{ marginTop: 12 }}>
        <Text text={t('available')} color="ticker_color2" size="xs" />
        <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Text text={availableAmount} color="ticker_color2" size="xs" wrap />
          <Text text={` ${unit}`} size="xs" style={{ color: 'rgba(255, 255, 255, 0.45)' }} disableTranslate wrap />
          {availableExtra}
        </Row>
      </Row>
      {footer}
    </Column>
  );
}
